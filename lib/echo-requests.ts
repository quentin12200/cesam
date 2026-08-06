import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { parseReproductionRules } from "@/lib/reproduction-rules";
import { getCurrentCycleBreeding } from "@/lib/current-reproduction-cycle";
import { getEchoListEntryDays } from "@/lib/echo-list-status";

export const ACTIVE_ECHO_REQUEST_WHERE = { etat: "A_FAIRE" } as const;

const UPSERT_BATCH_SIZE = 5;
const SYNC_FRESHNESS_MS = 2 * 60 * 1000;

let lastSuccessfulSyncAt = 0;
let syncInFlight: Promise<void> | null = null;

async function performAutomaticEchoSync() {
  const [storedRules, females, activeAutomaticRequests] = await Promise.all([
    prisma.exploitationConfig.findUnique({
      where: { id: "singleton" },
      select: { reproductionRulesJson: true },
    }).catch(() => null),
    prisma.animal.findMany({
      where: {
        statut: "ACTIF",
        sexbov: "F",
      },
      select: {
        id: true,
        saillies: {
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          select: { id: true, date: true, gestation: { select: { dateEcho: true } } },
        },
        velagesVache: {
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { date: true },
        },
      },
    }),
    prisma.demandeEchographie.findMany({
      where: { origine: "AUTOMATIQUE", etat: "A_FAIRE" },
      select: { id: true, animalId: true, saillieId: true },
    }),
  ]);

  const rules = parseReproductionRules(storedRules?.reproductionRulesJson);
  const echoPhase = rules.phases.find((phase) => phase.id === "echo_due");
  const listDisplayEnabled = echoPhase?.enabledAlert ?? true;
  const thresholdDays = getEchoListEntryDays(rules.echoTiming);

  const latestByAnimal = new Map<string, string>();
  const currentAttemptByAnimal = new Map<string, string>();
  const thresholdDate = subDays(new Date(), thresholdDays);
  for (const female of females) {
    const lastCalving = female.velagesVache[0]?.date ?? null;
    const currentAttempt = getCurrentCycleBreeding(female.saillies, lastCalving);
    if (!currentAttempt) continue;
    currentAttemptByAnimal.set(female.id, currentAttempt.id);
    if (
      listDisplayEnabled
      && currentAttempt.date <= thresholdDate
      && !currentAttempt.gestation?.dateEcho
    ) {
      latestByAnimal.set(female.id, currentAttempt.id);
    }
  }

  const obsoleteRequestIds = activeAutomaticRequests
    .filter((request) => currentAttemptByAnimal.get(request.animalId) !== request.saillieId)
    .map((request) => request.id);
  if (obsoleteRequestIds.length > 0) {
    await prisma.demandeEchographie.updateMany({
      where: { id: { in: obsoleteRequestIds } },
      data: { etat: "RETIREE", clotureeAt: new Date() },
    });
  }

  const obsoleteRequestIdSet = new Set(obsoleteRequestIds);
  const existingActiveSaillieIds = new Set(
    activeAutomaticRequests
      .filter((request) => !obsoleteRequestIdSet.has(request.id) && request.saillieId)
      .map((request) => request.saillieId as string),
  );
  const missingRequests = [...latestByAnimal]
    .filter(([, saillieId]) => !existingActiveSaillieIds.has(saillieId));

  for (let index = 0; index < missingRequests.length; index += UPSERT_BATCH_SIZE) {
    const batch = missingRequests.slice(index, index + UPSERT_BATCH_SIZE);
    await Promise.all(
      batch.map(([animalId, saillieId]) =>
        prisma.demandeEchographie.upsert({
          where: { requestKey: `AUTO:${saillieId}` },
          create: {
            animalId,
            saillieId,
            origine: "AUTOMATIQUE",
            etat: "A_FAIRE",
            motif: "DIAGNOSTIC_GESTATION",
            requestKey: `AUTO:${saillieId}`,
          },
          update: {},
        }),
      ),
    );
  }

  const activeAnimalIds = await prisma.demandeEchographie.findMany({
    where: { etat: "A_FAIRE" },
    distinct: ["animalId"],
    select: { animalId: true },
  });
  const activeIds = activeAnimalIds.map((request) => request.animalId);
  await prisma.animal.updateMany({
    where: { aEchographier: true, id: { notIn: activeIds } },
    data: { aEchographier: false },
  });
  if (activeIds.length > 0) {
    await prisma.animal.updateMany({
      where: { id: { in: activeIds } },
      data: { aEchographier: true },
    });
  }
}

export async function syncAutomaticEchoRequests(options?: { force?: boolean }) {
  const force = options?.force === true;
  const now = Date.now();

  if (!force && lastSuccessfulSyncAt > 0 && now - lastSuccessfulSyncAt < SYNC_FRESHNESS_MS) {
    return;
  }

  if (syncInFlight) {
    await syncInFlight;
    return;
  }

  syncInFlight = performAutomaticEchoSync()
    .then(() => {
      lastSuccessfulSyncAt = Date.now();
    })
    .finally(() => {
      syncInFlight = null;
    });

  await syncInFlight;
}

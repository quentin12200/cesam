import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { parseReproductionRules } from "@/lib/reproduction-rules";
import { getCurrentCycleBreeding } from "@/lib/current-reproduction-cycle";
import { getEchoListEntryDays } from "@/lib/echo-list-status";

export const ACTIVE_ECHO_REQUEST_WHERE = { etat: "A_FAIRE" } as const;

export async function syncAutomaticEchoRequests() {
  const storedRules = await prisma.exploitationConfig.findUnique({
    where: { id: "singleton" },
    select: { reproductionRulesJson: true },
  }).catch(() => null);
  const rules = parseReproductionRules(storedRules?.reproductionRulesJson);
  const echoPhase = rules.phases.find((phase) => phase.id === "echo_due");
  const listDisplayEnabled = echoPhase?.enabledAlert ?? true;
  const thresholdDays = getEchoListEntryDays(rules.echoTiming);

  const females = await prisma.animal.findMany({
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
  });

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

  const activeAutomaticRequests = await prisma.demandeEchographie.findMany({
    where: { origine: "AUTOMATIQUE", etat: "A_FAIRE" },
    select: { id: true, animalId: true, saillieId: true },
  });
  const obsoleteRequestIds = activeAutomaticRequests
    .filter((request) => currentAttemptByAnimal.get(request.animalId) !== request.saillieId)
    .map((request) => request.id);
  if (obsoleteRequestIds.length > 0) {
    await prisma.demandeEchographie.updateMany({
      where: { id: { in: obsoleteRequestIds } },
      data: { etat: "RETIREE", clotureeAt: new Date() },
    });
  }

  for (const [animalId, saillieId] of latestByAnimal) {
    await prisma.demandeEchographie.upsert({
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
    });
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

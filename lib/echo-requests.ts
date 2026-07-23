import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { parseReproductionRules } from "@/lib/reproduction-rules";

export const ACTIVE_ECHO_REQUEST_WHERE = { etat: "A_FAIRE" } as const;

export async function syncAutomaticEchoRequests() {
  const storedRules = await prisma.exploitationConfig.findUnique({
    where: { id: "singleton" },
    select: { reproductionRulesJson: true },
  }).catch(() => null);
  const rules = parseReproductionRules(storedRules?.reproductionRulesJson);
  const echoPhase = rules.phases.find((phase) => phase.id === "echo_due");
  const thresholdDays = echoPhase?.startRule.unit === "DAYS"
    ? Math.max(0, echoPhase.startRule.offset)
    : 40;

  const candidates = await prisma.saillie.findMany({
    where: {
      date: { lte: subDays(new Date(), thresholdDays) },
      animal: { statut: "ACTIF", sexbov: "F" },
      OR: [
        { gestation: null },
        { gestation: { etat: { notIn: ["VERT", "ROUGE"] } } },
      ],
    },
    orderBy: [{ animalId: "asc" }, { date: "desc" }, { createdAt: "desc" }],
    select: { id: true, animalId: true },
  });

  const latestByAnimal = new Map<string, string>();
  for (const candidate of candidates) {
    if (!latestByAnimal.has(candidate.animalId)) latestByAnimal.set(candidate.animalId, candidate.id);
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

  if (latestByAnimal.size > 0) {
    const activeAnimalIds = await prisma.demandeEchographie.findMany({
      where: { animalId: { in: [...latestByAnimal.keys()] }, etat: "A_FAIRE" },
      distinct: ["animalId"],
      select: { animalId: true },
    });
    await prisma.animal.updateMany({
      where: { id: { in: activeAnimalIds.map((request) => request.animalId) } },
      data: { aEchographier: true },
    });
  }
}

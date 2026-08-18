import { prisma } from "./prisma.ts";
import { calculateGmqKgPerDay } from "./field-weighing.ts";
import { elapsedWholeDays, predictedWeight, type SaleWeightSource } from "./sale-simulation.ts";

export type SaleSimulationCandidate = {
  id: string;
  nutrav: string;
  nobovi: string | null;
  lastWeight: number | null;
  lastWeightDate: string | null;
  gmq: number | null;
  predictionDays: number;
  predictedWeight: number | null;
  merchantWeight: number | null;
  manualWeight: number | null;
  source: SaleWeightSource;
  individualRefaction: number | null;
  individualPriceKg: number | null;
};

export async function saleSimulationCandidates(now = new Date()): Promise<SaleSimulationCandidate[]> {
  const animals = await prisma.animal.findMany({
    where: { statut: "ACTIF" },
    orderBy: { nutrav: "asc" },
    select: {
      id: true,
      nutrav: true,
      nobovi: true,
      pesees: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 2,
        select: { poids: true, date: true },
      },
    },
  });
  return animals.map((animal) => {
    const latest = animal.pesees[0] ?? null;
    const previous = animal.pesees[1] ?? null;
    const gmq = latest
      ? calculateGmqKgPerDay(latest.poids, latest.date, previous ? { poids: previous.poids, date: previous.date } : null)
      : null;
    const days = latest ? elapsedWholeDays(latest.date, now) : 0;
    return {
      id: animal.id,
      nutrav: animal.nutrav,
      nobovi: animal.nobovi,
      lastWeight: latest?.poids ?? null,
      lastWeightDate: latest?.date.toISOString() ?? null,
      gmq,
      predictionDays: days,
      predictedWeight: predictedWeight(latest?.poids ?? null, gmq, days),
      merchantWeight: null,
      manualWeight: null,
      source: latest ? "LAST_WEIGHT" : "MANUAL",
      individualRefaction: null,
      individualPriceKg: null,
    };
  });
}

export async function weighingSessionAnimalIds(sessionId: string | null): Promise<string[]> {
  if (!sessionId) return [];
  const session = await prisma.weighingSession.findUnique({
    where: { id: sessionId },
    select: { pesees: { orderBy: { createdAt: "asc" }, select: { animalId: true } } },
  });
  return session?.pesees.map((weight) => weight.animalId) ?? [];
}

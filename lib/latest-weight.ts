import { prisma } from "@/lib/prisma";

export async function getLatestWeight(animalId: string): Promise<{ poids: number; date: Date } | null> {
  const pesee = await prisma.pesee.findFirst({
    where: { animalId },
    orderBy: { date: "desc" },
    select: { poids: true, date: true },
  });
  return pesee ?? null;
}

export async function getLatestWeights(animalIds: string[]): Promise<Map<string, { poids: number; date: Date }>> {
  const pesees = await prisma.pesee.findMany({
    where: { animalId: { in: animalIds } },
    orderBy: { date: "desc" },
    select: { animalId: true, poids: true, date: true },
  });
  const map = new Map<string, { poids: number; date: Date }>();
  for (const p of pesees) {
    if (!map.has(p.animalId)) map.set(p.animalId, { poids: p.poids, date: p.date });
  }
  return map;
}

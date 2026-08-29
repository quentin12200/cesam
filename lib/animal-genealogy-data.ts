import "server-only";
import { prisma } from "@/lib/prisma";

export interface MatchedGenealogyAnimal {
  id: string;
  nutrav: string;
  nationalNumber: string;
  name: string | null;
  sex: string;
  status: string;
  category: string | null;
  birthDate: Date;
}

export function normalizeGenealogyNational(value: string | null | undefined) {
  return value?.replace(/\s+/g, "").replace(/^FR/i, "").toLocaleUpperCase("fr") ?? "";
}

export async function findAnimalsByExactNational(
  values: Array<string | null | undefined>,
): Promise<Map<string, MatchedGenealogyAnimal>> {
  const normalizedValues = [...new Set(values.map(normalizeGenealogyNational).filter(Boolean))];
  if (normalizedValues.length === 0) return new Map();

  const animals = await prisma.animal.findMany({
    where: {
      OR: normalizedValues.flatMap((value) => [
        { nunati: { contains: value } },
        { numeroNational: { contains: value } },
      ]),
    },
    select: {
      id: true,
      nutrav: true,
      nunati: true,
      numeroNational: true,
      nobovi: true,
      sexbov: true,
      statut: true,
      categorie: true,
      danais: true,
    },
  });

  const grouped = new Map<string, MatchedGenealogyAnimal[]>();
  for (const animal of animals) {
    const nationalNumber = animal.numeroNational ?? animal.nunati;
    const key = normalizeGenealogyNational(nationalNumber);
    if (!normalizedValues.includes(key)) continue;
    const group = grouped.get(key) ?? [];
    group.push({
      id: animal.id,
      nutrav: animal.nutrav,
      nationalNumber,
      name: animal.nobovi,
      sex: animal.sexbov,
      status: animal.statut,
      category: animal.categorie,
      birthDate: animal.danais,
    });
    grouped.set(key, group);
  }

  return new Map(
    [...grouped.entries()]
      .filter(([, matches]) => matches.length === 1)
      .map(([key, matches]) => [key, matches[0]]),
  );
}

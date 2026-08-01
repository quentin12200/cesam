export type NeverWeighedAnimalCandidate = {
  statut: string;
  danais: Date;
  weightCount: number;
};

export function isNeverWeighedAnimal(
  animal: NeverWeighedAnimalCandidate,
  thresholdDate: Date,
): boolean {
  return animal.statut === "ACTIF" && animal.danais <= thresholdDate && animal.weightCount === 0;
}

export function shouldShowActiveWeighingNews(session: {
  status: "ACTIVE" | "FINISHED" | "ABANDONED";
  weightCount: number;
} | null): boolean {
  return session?.status === "ACTIVE" && session.weightCount > 0;
}

export function neverWeighedAnimalWhere(referenceDate: Date): Prisma.AnimalWhereInput {
  return {
    statut: "ACTIF",
    danais: { lte: addMonths(referenceDate, -10) },
    pesees: { none: {} },
  };
}
import { addMonths } from "date-fns";
import type { Prisma } from "@prisma/client";

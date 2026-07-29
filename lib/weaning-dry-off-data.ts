import "server-only";

import { subMonths, startOfDay } from "date-fns";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildWeaningDryOffCandidates,
  resolveCalfMother,
  type WeaningDryOffCandidate,
} from "@/lib/weaning-dry-off";

const motherSelect = {
  id: true,
  nutrav: true,
  nobovi: true,
  statut: true,
  tarieFaite: true,
  dateTarie: true,
} as const;

export const calfMotherSelect = {
  id: true,
  nutrav: true,
  nobovi: true,
  danais: true,
  statut: true,
  sevreFait: true,
  dateSevrage: true,
  velageVeau: {
    select: { vache: { select: motherSelect } },
  },
  veauxVelage: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      velage: { select: { vache: { select: motherSelect } } },
    },
  },
  mere: { select: motherSelect },
} as const;

type CalfWithMother = Prisma.AnimalGetPayload<{
  select: typeof calfMotherSelect;
}>;

export async function findCalfWithMother(calfId: string) {
  return prisma.animal.findFirst({
    where: { id: calfId, statut: "ACTIF" },
    select: calfMotherSelect,
  });
}

export async function getWeaningDryOffCandidates(
  now: Date = new Date()
): Promise<{ thresholdMonths: number; candidates: WeaningDryOffCandidate[] }> {
  const config = await prisma.exploitationConfig
    .findUnique({
      where: { id: "singleton" },
      select: { tarissementVeauAgeMois: true },
    })
    .catch(() => null);
  const thresholdMonths = Math.max(
    1,
    Math.round(config?.tarissementVeauAgeMois ?? 6)
  );
  const latestBirthDate = subMonths(
    startOfDay(now),
    Math.max(0, thresholdMonths - 1)
  );

  const calves = await prisma.animal.findMany({
    where: {
      statut: "ACTIF",
      danais: { lte: latestBirthDate },
      OR: [
        { velageVeau: { isNot: null } },
        { veauxVelage: { some: {} } },
        { mereId: { not: null } },
      ],
    },
    select: calfMotherSelect,
    orderBy: [{ danais: "asc" }, { nutrav: "asc" }],
  });

  return {
    thresholdMonths,
    candidates: buildWeaningDryOffCandidates(calves, thresholdMonths, now),
  };
}

export function motherFromCalf(calf: NonNullable<CalfWithMother>) {
  return resolveCalfMother(calf);
}

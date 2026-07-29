import "server-only";

import { startOfDay, subMonths } from "date-fns";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildWeaningDryOffCandidates,
  getCurrentCalvingCycle,
  type WeaningDryOffCandidate,
} from "@/lib/weaning-dry-off";

const linkedCalfSelect = {
  id: true,
  statut: true,
  sevreFait: true,
} satisfies Prisma.AnimalSelect;

const motherSelect = {
  id: true,
  nutrav: true,
  nobovi: true,
  statut: true,
  tarieFaite: true,
  dateTarie: true,
  velagesVache: {
    orderBy: [
      { date: "desc" as const },
      { createdAt: "desc" as const },
    ],
    take: 1,
    select: { id: true, date: true },
  },
} satisfies Prisma.AnimalSelect;

const calvingCycleSelect = {
  id: true,
  date: true,
  vache: { select: motherSelect },
  veau: { select: linkedCalfSelect },
  veauxDetails: {
    select: { animal: { select: linkedCalfSelect } },
  },
} satisfies Prisma.VelageSelect;

export const calfCycleSelect = {
  id: true,
  nutrav: true,
  nobovi: true,
  danais: true,
  statut: true,
  sevreFait: true,
  dateSevrage: true,
  velageVeau: { select: calvingCycleSelect },
  veauxVelage: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { velage: { select: calvingCycleSelect } },
  },
} satisfies Prisma.AnimalSelect;

type CalfWithCycle = Prisma.AnimalGetPayload<{
  select: typeof calfCycleSelect;
}>;

export async function findCalfWithCurrentCycle(calfId: string) {
  const calf = await prisma.animal.findFirst({
    where: { id: calfId, statut: "ACTIF" },
    select: calfCycleSelect,
  });
  if (!calf) return null;

  const currentCycle = getCurrentCalvingCycle(calf);
  return currentCycle ? { calf, currentCycle } : null;
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
  const reversibleSince = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const calves = await prisma.animal.findMany({
    where: {
      statut: "ACTIF",
      AND: [
        {
          OR: [
            {
              sevreFait: false,
              danais: { lte: latestBirthDate },
            },
            {
              sevreFait: true,
              dateSevrage: { gte: reversibleSince, lte: now },
            },
          ],
        },
        {
          OR: [
            { velageVeau: { isNot: null } },
            { veauxVelage: { some: {} } },
          ],
        },
      ],
    },
    select: calfCycleSelect,
    orderBy: [{ danais: "asc" }, { nutrav: "asc" }],
  });

  const automaticActions = await prisma.actionLog.findMany({
    where: {
      type: {
        in: [
          "SEVRAGE_TARISSEMENT_AUTO",
          "SEVRAGE_TARISSEMENT",
          "PATCH_ANIMAL",
        ],
      },
      reverted: false,
      createdAt: { gte: reversibleSince },
    },
    select: { revertData: true },
  });
  const automaticCalfIds = new Set<string>();
  const automaticCalfNumbers = new Set<string>();
  for (const action of automaticActions) {
    try {
      const raw = JSON.parse(action.revertData);
      const steps = Array.isArray(raw) ? raw : [raw];
      for (const step of steps) {
        if (
          step?.op === "update" &&
          step?.model === "animal" &&
          step?.data?.sevreFait === false &&
          (typeof step?.where?.id === "string" ||
            typeof step?.where?.nutrav === "string")
        ) {
          if (typeof step.where.id === "string") {
            automaticCalfIds.add(step.where.id);
          }
          if (typeof step.where.nutrav === "string") {
            automaticCalfNumbers.add(step.where.nutrav);
          }
        }
      }
    } catch {}
  }

  return {
    thresholdMonths,
    candidates: buildWeaningDryOffCandidates(
      calves.map((calf) => ({
        ...calf,
        automaticDryOffAtWeaning:
          automaticCalfIds.has(calf.id) ||
          automaticCalfNumbers.has(calf.nutrav),
      })),
      thresholdMonths,
      now
    ),
  };
}

export type { CalfWithCycle };

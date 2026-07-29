import { addMonths, isAfter, isSameDay, startOfDay } from "date-fns";

export type WeaningWindow = "NOW" | "SOON";
export type WeaningDryOffAction =
  | "COMBINED"
  | "WEAN_ONLY"
  | "DRY_OFF_ONLY"
  | "UNDO_WEANING";

export interface WeaningDryOffAnimal {
  id: string;
  nutrav: string;
  nobovi: string | null;
}

export interface WeaningDryOffCandidate {
  calf: WeaningDryOffAnimal & {
    birthDate: string;
    weaned: boolean;
    weaningDate: string | null;
  };
  mother: WeaningDryOffAnimal & {
    driedOff: boolean;
    dryOffDate: string | null;
  };
  cycleId: string;
  cycleDate: string;
  cycleCalfCount: number;
  cycleWeanedCount: number;
  cyclePendingCount: number;
  willAutoDryOff: boolean;
  recentlyWeaned: boolean;
  reversibleUntil: string | null;
  automaticDryOffAtWeaning: boolean;
  window: WeaningWindow;
  thresholdDate: string;
  anticipationDate: string;
  reachedThresholdToday: boolean;
  needsWeaning: boolean;
  needsDryOff: boolean;
}

export interface CalfMotherLinks<TMother> {
  velageVeau?: { vache: TMother | null } | null;
  veauxVelage?: Array<{ velage: { vache: TMother | null } }>;
  mere?: TMother | null;
}

export interface LinkedCycleCalf {
  id: string;
  statut: string;
  sevreFait: boolean;
}

export interface CandidateMotherRecord extends WeaningDryOffAnimal {
  statut: string;
  tarieFaite: boolean;
  dateTarie: Date | null;
  velagesVache: Array<{ id: string; date: Date }>;
}

export interface CalvingCycleRecord {
  id: string;
  date: Date;
  vache: CandidateMotherRecord;
  veau: LinkedCycleCalf | null;
  veauxDetails: Array<{ animal: LinkedCycleCalf | null }>;
}

export interface CalfCycleLinks {
  velageVeau?: CalvingCycleRecord | null;
  veauxVelage?: Array<{ velage: CalvingCycleRecord }>;
}

export interface CandidateCalfRecord extends CalfCycleLinks {
  id: string;
  nutrav: string;
  nobovi: string | null;
  danais: Date;
  statut: string;
  sevreFait: boolean;
  dateSevrage: Date | null;
  automaticDryOffAtWeaning?: boolean;
}

export interface CurrentCalvingCycle {
  cycle: CalvingCycleRecord;
  mother: CandidateMotherRecord;
  linkedCalves: LinkedCycleCalf[];
  pendingCalves: LinkedCycleCalf[];
}

export function resolveCalfMother<TMother>(
  calf: CalfMotherLinks<TMother>
): TMother | null {
  return (
    calf.velageVeau?.vache ??
    calf.veauxVelage?.[0]?.velage.vache ??
    calf.mere ??
    null
  );
}

export function resolveCalfCycle(
  calf: CalfCycleLinks
): CalvingCycleRecord | null {
  return calf.velageVeau ?? calf.veauxVelage?.[0]?.velage ?? null;
}

export function collectLinkedCycleCalves(
  cycle: CalvingCycleRecord
): LinkedCycleCalf[] {
  const calves = new Map<string, LinkedCycleCalf>();
  if (cycle.veau) calves.set(cycle.veau.id, cycle.veau);
  for (const detail of cycle.veauxDetails) {
    if (detail.animal) calves.set(detail.animal.id, detail.animal);
  }
  return [...calves.values()];
}

export function getCurrentCalvingCycle(
  calf: CandidateCalfRecord
): CurrentCalvingCycle | null {
  const cycle = resolveCalfCycle(calf);
  if (!cycle || cycle.vache.statut !== "ACTIF") return null;

  const latestCalving = cycle.vache.velagesVache[0];
  if (!latestCalving || latestCalving.id !== cycle.id) return null;

  const linkedCalves = collectLinkedCycleCalves(cycle);
  if (!linkedCalves.some((linkedCalf) => linkedCalf.id === calf.id)) {
    return null;
  }

  return {
    cycle,
    mother: cycle.vache,
    linkedCalves,
    // ACTIF est le seul statut opérationnel. SORTI, MORT et VENDU ne
    // nécessitent plus de sevrage et ne doivent pas bloquer le tarissement.
    pendingCalves: linkedCalves.filter(
      (linkedCalf) =>
        linkedCalf.statut === "ACTIF" && !linkedCalf.sevreFait
    ),
  };
}

export function classifyWeaningWindow(
  birthDate: Date,
  thresholdMonths: number,
  now: Date = new Date()
): {
  window: WeaningWindow | null;
  thresholdDate: Date;
  anticipationDate: Date;
  reachedThresholdToday: boolean;
} {
  const safeThresholdMonths = Math.max(1, Math.round(thresholdMonths));
  const today = startOfDay(now);
  const thresholdDate = startOfDay(addMonths(birthDate, safeThresholdMonths));
  const anticipationDate = startOfDay(
    addMonths(birthDate, Math.max(0, safeThresholdMonths - 1))
  );

  const window = !isAfter(anticipationDate, today)
    ? !isAfter(thresholdDate, today)
      ? "NOW"
      : "SOON"
    : null;

  return {
    window,
    thresholdDate,
    anticipationDate,
    reachedThresholdToday: isSameDay(thresholdDate, today),
  };
}

export function buildWeaningDryOffCandidates(
  calves: CandidateCalfRecord[],
  thresholdMonths: number,
  now: Date = new Date()
): WeaningDryOffCandidate[] {
  const candidates = new Map<string, WeaningDryOffCandidate>();
  for (const calf of calves) {
    if (calf.statut !== "ACTIF") continue;

    const reversibleUntil = calf.dateSevrage
      ? new Date(calf.dateSevrage.getTime() + 12 * 60 * 60 * 1000)
      : null;
    const recentlyWeaned = Boolean(
      calf.sevreFait &&
        calf.dateSevrage &&
        reversibleUntil &&
        reversibleUntil > now &&
        calf.dateSevrage <= now
    );
    if (calf.sevreFait && !recentlyWeaned) continue;

    const timing = classifyWeaningWindow(calf.danais, thresholdMonths, now);
    if (!timing.window) continue;

    const currentCycle = getCurrentCalvingCycle(calf);
    if (!currentCycle) continue;

    const cycleWeanedCount = currentCycle.linkedCalves.filter(
      (linkedCalf) => linkedCalf.sevreFait
    ).length;
    const willAutoDryOff =
      !currentCycle.mother.tarieFaite &&
      currentCycle.pendingCalves.length === 1 &&
      currentCycle.pendingCalves[0]?.id === calf.id;

    candidates.set(calf.id, {
      calf: {
        id: calf.id,
        nutrav: calf.nutrav,
        nobovi: calf.nobovi,
        birthDate: calf.danais.toISOString(),
        weaned: false,
        weaningDate: null,
      },
      mother: {
        id: currentCycle.mother.id,
        nutrav: currentCycle.mother.nutrav,
        nobovi: currentCycle.mother.nobovi,
        driedOff: currentCycle.mother.tarieFaite,
        dryOffDate: currentCycle.mother.dateTarie?.toISOString() ?? null,
      },
      cycleId: currentCycle.cycle.id,
      cycleDate: currentCycle.cycle.date.toISOString(),
      cycleCalfCount: currentCycle.linkedCalves.length,
      cycleWeanedCount,
      cyclePendingCount: currentCycle.pendingCalves.length,
      willAutoDryOff,
      recentlyWeaned,
      reversibleUntil: recentlyWeaned
        ? reversibleUntil?.toISOString() ?? null
        : null,
      automaticDryOffAtWeaning: Boolean(
        recentlyWeaned && calf.automaticDryOffAtWeaning
      ),
      window: timing.window,
      thresholdDate: timing.thresholdDate.toISOString(),
      anticipationDate: timing.anticipationDate.toISOString(),
      reachedThresholdToday: timing.reachedThresholdToday,
      needsWeaning: !recentlyWeaned,
      needsDryOff: !currentCycle.mother.tarieFaite,
    });
  }
  return [...candidates.values()];
}

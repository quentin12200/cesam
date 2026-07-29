import { addMonths, isAfter, isSameDay, startOfDay } from "date-fns";

export type WeaningWindow = "NOW" | "SOON";
export type WeaningDryOffAction = "COMBINED" | "WEAN_ONLY" | "DRY_OFF_ONLY";

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
  mother: (WeaningDryOffAnimal & {
    driedOff: boolean;
    dryOffDate: string | null;
  }) | null;
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

export interface CandidateMotherRecord extends WeaningDryOffAnimal {
  statut: string;
  tarieFaite: boolean;
  dateTarie: Date | null;
}

export interface CandidateCalfRecord
  extends CalfMotherLinks<CandidateMotherRecord> {
  id: string;
  nutrav: string;
  nobovi: string | null;
  danais: Date;
  statut: string;
  sevreFait: boolean;
  dateSevrage: Date | null;
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
    const timing = classifyWeaningWindow(calf.danais, thresholdMonths, now);
    if (!timing.window) continue;
    const linkedMother = resolveCalfMother(calf);
    const mother = linkedMother?.statut === "ACTIF" ? linkedMother : null;
    const needsWeaning = !calf.sevreFait;
    const needsDryOff = Boolean(mother && !mother.tarieFaite);
    if (!needsWeaning && !needsDryOff) continue;

    candidates.set(calf.id, {
      calf: {
        id: calf.id,
        nutrav: calf.nutrav,
        nobovi: calf.nobovi,
        birthDate: calf.danais.toISOString(),
        weaned: calf.sevreFait,
        weaningDate: calf.dateSevrage?.toISOString() ?? null,
      },
      mother: mother
        ? {
            id: mother.id,
            nutrav: mother.nutrav,
            nobovi: mother.nobovi,
            driedOff: mother.tarieFaite,
            dryOffDate: mother.dateTarie?.toISOString() ?? null,
          }
        : null,
      window: timing.window,
      thresholdDate: timing.thresholdDate.toISOString(),
      anticipationDate: timing.anticipationDate.toISOString(),
      reachedThresholdToday: timing.reachedThresholdToday,
      needsWeaning,
      needsDryOff,
    });
  }
  return [...candidates.values()];
}

export function applySuccessfulWeaningDryOffAction(
  candidate: WeaningDryOffCandidate,
  action: WeaningDryOffAction,
  date: string
): WeaningDryOffCandidate | null {
  const wean = action === "COMBINED" || action === "WEAN_ONLY";
  const dryOff = action === "COMBINED" || action === "DRY_OFF_ONLY";
  const next = {
    ...candidate,
    calf: wean
      ? { ...candidate.calf, weaned: true, weaningDate: date }
      : candidate.calf,
    mother:
      dryOff && candidate.mother
        ? { ...candidate.mother, driedOff: true, dryOffDate: date }
        : candidate.mother,
    needsWeaning: wean ? false : candidate.needsWeaning,
    needsDryOff: dryOff ? false : candidate.needsDryOff,
  };
  return next.needsWeaning || next.needsDryOff ? next : null;
}

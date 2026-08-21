export const RENEWAL_CANDIDATE_CATEGORIES = [
  "PRESELECTION_GENISSE",
  "PETITE_GENISSE",
  "MOYENNE_GENISSE",
  "GRANDE_GENISSE",
] as const;

export type RenewalDecision = "GARDER" | "A_REVOIR" | "SORTIR";
export type CowExitDecision = "DECIDEE" | "A_SURVEILLER" | "PAS_PREVUE";

export interface RenewalSettings {
  targetMothers: number;
  renewalRatePercent: number;
  firstCalvingAgeMonths: number;
}

export interface RenewalProjection {
  annualNeed: number;
  selectionMargin: number;
  projectedMothers: number;
  change: number;
}

export interface ParentIdentity {
  id?: string | null;
  workNumber?: string | null;
  name?: string | null;
  nationalNumber?: string | null;
}

export interface CandidateParentSources {
  directMother?: ParentIdentity | null;
  calvingMother?: ParentIdentity | null;
  calvingFather?: ParentIdentity | null;
  breedingBull?: ParentIdentity | null;
}

export const DEFAULT_RENEWAL_RATE = 20;
export const DEFAULT_FIRST_CALVING_AGE_MONTHS = 30;

export function calculateAnnualRenewalNeed(targetMothers: number, renewalRatePercent: number): number {
  return Math.max(0, Math.round(Math.max(0, targetMothers) * Math.max(0, renewalRatePercent) / 100));
}

export function calculateRenewalProjection(input: {
  currentMothers: number;
  targetMothers: number;
  renewalRatePercent: number;
  candidates: number;
  keptCandidates: number;
  plannedExits: number;
}): RenewalProjection {
  const annualNeed = calculateAnnualRenewalNeed(input.targetMothers, input.renewalRatePercent);
  const projectedMothers = Math.max(0, input.currentMothers + input.keptCandidates - input.plannedExits);
  return {
    annualNeed,
    selectionMargin: input.candidates - annualNeed,
    projectedMothers,
    change: projectedMothers - input.currentMothers,
  };
}

export function countRenewalDecisions(decisions: Record<string, RenewalDecision>): { kept: number; review: number; rejected: number; total: number } {
  const values = Object.values(decisions);
  return {
    kept: values.filter((value) => value === "GARDER").length,
    review: values.filter((value) => value === "A_REVOIR").length,
    rejected: values.filter((value) => value === "SORTIR").length,
    total: values.length,
  };
}

export function renewalPilotMessage(candidateCount: number, annualNeed: number): { tone: "green" | "orange" | "red"; text: string } {
  const margin = candidateCount - annualNeed;
  if (margin < 0) return { tone: "red", text: `${candidateCount} candidates pour un besoin théorique de ${annualNeed} : risque de manquer de renouvellement.` };
  if (margin <= 3) return { tone: "green", text: `${candidateCount} candidates pour un besoin estimé de ${annualNeed} : marge de sélection correcte.` };
  return { tone: "orange", text: `${candidateCount} candidates pour un besoin estimé de ${annualNeed} : ${margin} candidates au-delà du besoin théorique.` };
}

export function projectionMessage(currentMothers: number, keptCandidates: number, plannedExits: number): { tone: "green" | "orange"; text: string } {
  const projected = currentMothers + keptCandidates - plannedExits;
  const change = projected - currentMothers;
  if (change === 0) return { tone: "green", text: `Troupeau stable : environ ${projected} mères.` };
  if (change > 0) return { tone: "orange", text: `Si ${keptCandidates} génisses entrent et ${plannedExits} vaches sortent, le troupeau augmentera de ${change} mère${change > 1 ? "s" : ""}, à environ ${projected}.` };
  return { tone: "orange", text: `Avec ${keptCandidates} entrées et ${plannedExits} sorties, le troupeau diminuera de ${Math.abs(change)} mère${Math.abs(change) > 1 ? "s" : ""}, à environ ${projected}.` };
}

export function resolveCandidateParents(sources: CandidateParentSources): { mother: ParentIdentity | null; father: ParentIdentity | null } {
  return {
    mother: sources.directMother ?? sources.calvingMother ?? null,
    father: sources.breedingBull ?? sources.calvingFather ?? null,
  };
}

export function parentDisplay(parent: ParentIdentity | null, kind: "mother" | "father"): string {
  if (!parent) return kind === "mother" ? "Mère inconnue" : "Père inconnu";
  const identifier = parent.workNumber ?? parent.name ?? parent.nationalNumber;
  const complement = parent.workNumber && parent.name ? ` ${parent.name}` : parent.name && parent.nationalNumber ? ` · ${parent.nationalNumber}` : "";
  return identifier ? `${identifier}${complement}` : kind === "mother" ? "Mère inconnue" : "Père inconnu";
}

export function groupCandidatesByParent<T>(candidates: T[], parent: (candidate: T) => ParentIdentity | null, unknownLabel: string): Array<{ key: string; label: string; candidates: T[] }> {
  const groups = new Map<string, { label: string; candidates: T[] }>();
  for (const candidate of candidates) {
    const identity = parent(candidate);
    const key = identity?.id ?? identity?.nationalNumber ?? identity?.workNumber ?? identity?.name ?? unknownLabel;
    const label = identity ? parentDisplay(identity, unknownLabel.startsWith("Mère") ? "mother" : "father") : unknownLabel;
    const group = groups.get(key) ?? { label, candidates: [] };
    group.candidates.push(candidate);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => b.candidates.length - a.candidates.length || a.label.localeCompare(b.label, "fr"));
}

export function probableEntryYear(birthDate: Date | string, firstCalvingAgeMonths: number): number {
  const date = new Date(birthDate);
  date.setMonth(date.getMonth() + Math.max(1, Math.round(firstCalvingAgeMonths)));
  return date.getFullYear();
}

export function parseRenewalSettings(raw: string | null | undefined, currentMothers: number): RenewalSettings {
  try {
    const value = raw ? JSON.parse(raw) as { renewalPlanning?: Partial<RenewalSettings> } : {};
    const stored = value.renewalPlanning ?? {};
    return {
      targetMothers: positiveInteger(stored.targetMothers, currentMothers),
      renewalRatePercent: boundedNumber(stored.renewalRatePercent, DEFAULT_RENEWAL_RATE, 0, 100),
      firstCalvingAgeMonths: positiveInteger(stored.firstCalvingAgeMonths, DEFAULT_FIRST_CALVING_AGE_MONTHS),
    };
  } catch {
    return { targetMothers: currentMothers, renewalRatePercent: DEFAULT_RENEWAL_RATE, firstCalvingAgeMonths: DEFAULT_FIRST_CALVING_AGE_MONTHS };
  }
}

export function mergeRenewalSettings(raw: string | null | undefined, settings: RenewalSettings): string {
  let existing: Record<string, unknown> = {};
  try { existing = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch {}
  return JSON.stringify({ ...existing, renewalPlanning: settings });
}

function positiveInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : Math.max(1, Math.round(fallback));
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

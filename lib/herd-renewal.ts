export const RENEWAL_PIPELINE_CATEGORIES = ["PETITE_GENISSE", "MOYENNE_GENISSE", "GRANDE_GENISSE"] as const;
export type RenewalStage = typeof RENEWAL_PIPELINE_CATEGORIES[number];
export type RenewalDecision = "NON_DECIDEE" | "GARDER" | "A_REVOIR" | "SORTIR";
export type CowExitDecision = "DECIDEE" | "A_SURVEILLER" | "PAS_PREVUE";

export interface RenewalSettings { targetMothers: number; renewalRatePercent: number; renewalGenerationStartMonth: number }
export interface ParentIdentity { id?: string | null; workNumber?: string | null; name?: string | null; nationalNumber?: string | null }
export interface CandidateParentSources { directMother?: ParentIdentity | null; calvingMother?: ParentIdentity | null; calvingFather?: ParentIdentity | null; breedingBull?: ParentIdentity | null }
export interface FirstCalvingRecord { birthDate: Date | string; calvings: Array<Date | string> }
export interface FirstCalvingAverage { averageMonths: number; medianMonths: number; sampleSize: number; fallback: boolean }
export interface ProjectedEntry { id: string; entryDate: Date | string; included?: boolean }
export interface RenewalGenerationProjection {
  generation: number;
  entries: number;
  identifiedExits: number;
  totalExitsNeeded: number;
  remainingExits: number;
}
export interface MotherAuditAnimal { id: string; hasCalving: boolean; effectiveCategory: string; estGenisse: boolean; birthDate: Date | string }
export interface MotherAudit {
  total: number;
  cows: number;
  toFatten: number;
  fattening: number;
  inconsistentIds: string[];
  motherIds: string[];
}

export const DEFAULT_RENEWAL_RATE = 20;
export const FALLBACK_FIRST_CALVING_MONTHS = 36;
export const DEFAULT_RENEWAL_GENERATION_START_MONTH = 9;
const DAYS_PER_MONTH = 365.25 / 12;

export function calculateAnnualRenewalNeed(targetMothers: number, renewalRatePercent: number): number {
  return Math.max(0, Math.round(Math.max(0, targetMothers) * Math.max(0, renewalRatePercent) / 100));
}

export function motherUpdateAfterCalving(isFirstCalving: boolean) {
  return isFirstCalving ? { estGenisse: false as const, categorie: "VACHE" as const } : {};
}

export function isCurrentMother(calvingCount: number): boolean { return calvingCount > 0; }
export function isAutomaticPlannedExit(calvingCount: number, category: string | null | undefined): boolean {
  return isCurrentMother(calvingCount) && (category === "A_ENGRAISSER" || category === "ENGRAISSEMENT");
}

export function calculateAverageFirstCalvingAge(records: FirstCalvingRecord[]): FirstCalvingAverage {
  const ages = records.flatMap((record) => {
    if (!record.calvings.length) return [];
    const birth = new Date(record.birthDate);
    const first = record.calvings.map((date) => new Date(date)).sort((a, b) => a.getTime() - b.getTime())[0];
    const months = (first.getTime() - birth.getTime()) / 86400000 / DAYS_PER_MONTH;
    return Number.isFinite(months) && months >= 24 && months <= 48 ? [months] : [];
  });
  if (!ages.length) return { averageMonths: FALLBACK_FIRST_CALVING_MONTHS, medianMonths: FALLBACK_FIRST_CALVING_MONTHS, sampleSize: 0, fallback: true };
  const sorted = [...ages].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    averageMonths: Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length * 10) / 10,
    medianMonths: Math.round(median * 10) / 10,
    sampleSize: ages.length,
    fallback: false,
  };
}

export function estimateMotherEntryDate(input: { birthDate: Date | string; expectedCalvingDate?: Date | string | null; firstCalvingAverageMonths: number }): Date {
  if (input.expectedCalvingDate) {
    const expected = new Date(input.expectedCalvingDate);
    if (!Number.isNaN(expected.getTime())) return expected;
  }
  const birth = new Date(input.birthDate);
  const wholeMonths = Math.trunc(input.firstCalvingAverageMonths);
  const fractionDays = Math.round((input.firstCalvingAverageMonths - wholeMonths) * DAYS_PER_MONTH);
  birth.setMonth(birth.getMonth() + wholeMonths);
  birth.setDate(birth.getDate() + fractionDays);
  return birth;
}

export function renewalGenerationForDate(date: Date | string, startMonth: number): number {
  const value = new Date(date);
  const safeStartMonth = Math.min(12, Math.max(1, Math.round(startMonth)));
  return value.getFullYear() - (value.getMonth() + 1 < safeStartMonth ? 1 : 0);
}

export function buildRenewalGenerationProjection(input: {
  currentDate: Date | string;
  minimumGenerations?: number;
  generationStartMonth: number;
  currentMothers: number;
  targetMothers: number;
  entries: ProjectedEntry[];
  identifiedExitsCurrentGeneration: number;
}): RenewalGenerationProjection[] {
  const includedEntries = input.entries.filter((entry) => entry.included !== false);
  const currentGeneration = renewalGenerationForDate(input.currentDate, input.generationStartMonth);
  const lastEntryGeneration = includedEntries.reduce((max, entry) => Math.max(max, renewalGenerationForDate(entry.entryDate, input.generationStartMonth)), currentGeneration);
  const lastGeneration = Math.max(currentGeneration + Math.max(3, input.minimumGenerations ?? 3) - 1, lastEntryGeneration);
  const result: RenewalGenerationProjection[] = [];
  for (let generation = currentGeneration; generation <= lastGeneration; generation++) {
    const entries = includedEntries.filter((entry) => renewalGenerationForDate(entry.entryDate, input.generationStartMonth) === generation).length;
    const identifiedExits = generation === currentGeneration ? input.identifiedExitsCurrentGeneration : 0;
    const totalExitsNeeded = generation === currentGeneration
      ? Math.max(0, input.currentMothers + entries - input.targetMothers)
      : entries;
    result.push({
      generation,
      entries,
      identifiedExits,
      totalExitsNeeded,
      remainingExits: Math.max(0, totalExitsNeeded - identifiedExits),
    });
  }
  return result;
}

export function auditCurrentMothers(animals: MotherAuditAnimal[], referenceDate = new Date()): MotherAudit {
  const mothers = animals.filter((animal) => {
    const ageMonths = (referenceDate.getTime() - new Date(animal.birthDate).getTime()) / 86400000 / DAYS_PER_MONTH;
    return animal.hasCalving || animal.effectiveCategory === "VACHE" || (!animal.estGenisse && ageMonths >= 24);
  });
  const ids = new Set(mothers.map((animal) => animal.id));
  const categoryCount = (category: string) => mothers.filter((animal) => animal.effectiveCategory === category).length;
  const inconsistentIds = animals.filter((animal) =>
    (animal.effectiveCategory === "VACHE" && !animal.hasCalving)
    || (animal.hasCalving && ["PETITE_GENISSE", "MOYENNE_GENISSE", "GRANDE_GENISSE"].includes(animal.effectiveCategory))
  ).map((animal) => animal.id);
  const toFatten = categoryCount("A_ENGRAISSER");
  const fattening = categoryCount("ENGRAISSEMENT");
  return { total: ids.size, cows: ids.size - toFatten - fattening, toFatten, fattening, inconsistentIds, motherIds: [...ids] };
}

export function countRenewalDecisions(decisions: Record<string, RenewalDecision>) {
  const values = Object.values(decisions);
  return { undecided: values.filter((value) => value === "NON_DECIDEE").length, kept: values.filter((value) => value === "GARDER").length, review: values.filter((value) => value === "A_REVOIR").length, rejected: values.filter((value) => value === "SORTIR").length, total: values.length };
}

export function renewalPilotMessage(candidateCount: number, annualNeed: number): { tone: "green" | "orange" | "red"; text: string } {
  const margin = candidateCount - annualNeed;
  if (margin < 0) return { tone: "red", text: `${candidateCount} petites génisses pour un besoin théorique de ${annualNeed} : risque de manquer de renouvellement pour leur future entrée.` };
  if (margin <= 3) return { tone: "green", text: `${candidateCount} petites génisses pour un besoin estimé de ${annualNeed} : marge de sélection correcte.` };
  return { tone: "orange", text: `${candidateCount} petites génisses pour un besoin estimé de ${annualNeed} : ${margin} candidates au-delà du repère annuel.` };
}

export function resolveCandidateParents(sources: CandidateParentSources) { return { mother: sources.directMother ?? sources.calvingMother ?? null, father: sources.breedingBull ?? sources.calvingFather ?? null }; }

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
    group.candidates.push(candidate); groups.set(key, group);
  }
  return [...groups.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => b.candidates.length - a.candidates.length || a.label.localeCompare(b.label, "fr"));
}

export function parseRenewalSettings(raw: string | null | undefined, currentMothers: number): RenewalSettings {
  try {
    const stored = (raw ? JSON.parse(raw) as { renewalPlanning?: Partial<RenewalSettings> } : {}).renewalPlanning ?? {};
    return {
      targetMothers: positiveInteger(stored.targetMothers, currentMothers),
      renewalRatePercent: boundedNumber(stored.renewalRatePercent, DEFAULT_RENEWAL_RATE, 0, 100),
      renewalGenerationStartMonth: boundedInteger(stored.renewalGenerationStartMonth, DEFAULT_RENEWAL_GENERATION_START_MONTH, 1, 12),
    };
  } catch { return { targetMothers: Math.max(1, currentMothers), renewalRatePercent: DEFAULT_RENEWAL_RATE, renewalGenerationStartMonth: DEFAULT_RENEWAL_GENERATION_START_MONTH }; }
}

export function mergeRenewalSettings(raw: string | null | undefined, settings: RenewalSettings): string {
  let existing: Record<string, unknown> = {};
  try { existing = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch {}
  const previous = typeof existing.renewalPlanning === "object" && existing.renewalPlanning ? existing.renewalPlanning as Record<string, unknown> : {};
  return JSON.stringify({ ...existing, renewalPlanning: { ...previous, ...settings } });
}

function positiveInteger(value: unknown, fallback: number) { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.round(number) : Math.max(1, Math.round(fallback)); }
function boundedNumber(value: unknown, fallback: number, min: number, max: number) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }
function boundedInteger(value: unknown, fallback: number, min: number, max: number) { return Math.round(boundedNumber(value, fallback, min, max)); }

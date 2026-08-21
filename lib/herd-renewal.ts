export const RENEWAL_PIPELINE_CATEGORIES = ["PETITE_GENISSE", "MOYENNE_GENISSE", "GRANDE_GENISSE"] as const;
export type RenewalStage = typeof RENEWAL_PIPELINE_CATEGORIES[number];
export type RenewalDecision = "GARDER" | "A_REVOIR" | "SORTIR";
export type CowExitDecision = "DECIDEE" | "A_SURVEILLER" | "PAS_PREVUE";

export interface RenewalSettings { targetMothers: number; renewalRatePercent: number }
export interface ParentIdentity { id?: string | null; workNumber?: string | null; name?: string | null; nationalNumber?: string | null }
export interface CandidateParentSources { directMother?: ParentIdentity | null; calvingMother?: ParentIdentity | null; calvingFather?: ParentIdentity | null; breedingBull?: ParentIdentity | null }
export interface FirstCalvingRecord { birthDate: Date | string; calvings: Array<Date | string> }
export interface FirstCalvingAverage { averageMonths: number; sampleSize: number; fallback: boolean }
export interface ProjectedEntry { id: string; entryDate: Date | string; included?: boolean }
export interface AnnualRenewalProjection {
  year: number;
  mothersAtStart: number;
  entries: number;
  identifiedExits: number;
  exitsNeededForTarget: number;
  projectedMothers: number;
}

export const DEFAULT_RENEWAL_RATE = 20;
export const FALLBACK_FIRST_CALVING_MONTHS = 36;
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
  if (!ages.length) return { averageMonths: FALLBACK_FIRST_CALVING_MONTHS, sampleSize: 0, fallback: true };
  return { averageMonths: Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length * 10) / 10, sampleSize: ages.length, fallback: false };
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

export function buildAnnualRenewalProjection(input: {
  currentYear: number;
  minimumYears?: number;
  currentMothers: number;
  targetMothers: number;
  entries: ProjectedEntry[];
  identifiedExitsCurrentYear: number;
}): AnnualRenewalProjection[] {
  const includedEntries = input.entries.filter((entry) => entry.included !== false);
  const lastEntryYear = includedEntries.reduce((max, entry) => Math.max(max, new Date(entry.entryDate).getFullYear()), input.currentYear);
  const lastYear = Math.max(input.currentYear + Math.max(3, input.minimumYears ?? 3) - 1, lastEntryYear);
  const result: AnnualRenewalProjection[] = [];
  let mothersAtStart = input.currentMothers;
  for (let year = input.currentYear; year <= lastYear; year++) {
    const entries = includedEntries.filter((entry) => new Date(entry.entryDate).getFullYear() === year).length;
    const identifiedExits = year === input.currentYear ? input.identifiedExitsCurrentYear : 0;
    const projectedMothers = Math.max(0, mothersAtStart + entries - identifiedExits);
    result.push({
      year,
      mothersAtStart,
      entries,
      identifiedExits,
      exitsNeededForTarget: Math.max(0, mothersAtStart + entries - input.targetMothers),
      projectedMothers,
    });
    mothersAtStart = projectedMothers;
  }
  return result;
}

export function countRenewalDecisions(decisions: Record<string, RenewalDecision>) {
  const values = Object.values(decisions);
  return { kept: values.filter((value) => value === "GARDER").length, review: values.filter((value) => value === "A_REVOIR").length, rejected: values.filter((value) => value === "SORTIR").length, total: values.length };
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
    return { targetMothers: positiveInteger(stored.targetMothers, currentMothers), renewalRatePercent: boundedNumber(stored.renewalRatePercent, DEFAULT_RENEWAL_RATE, 0, 100) };
  } catch { return { targetMothers: Math.max(1, currentMothers), renewalRatePercent: DEFAULT_RENEWAL_RATE }; }
}

export function mergeRenewalSettings(raw: string | null | undefined, settings: RenewalSettings): string {
  let existing: Record<string, unknown> = {};
  try { existing = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch {}
  const previous = typeof existing.renewalPlanning === "object" && existing.renewalPlanning ? existing.renewalPlanning as Record<string, unknown> : {};
  return JSON.stringify({ ...existing, renewalPlanning: { ...previous, ...settings } });
}

function positiveInteger(value: unknown, fallback: number) { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.round(number) : Math.max(1, Math.round(fallback)); }
function boundedNumber(value: unknown, fallback: number, min: number, max: number) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }

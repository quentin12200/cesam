export type GestationRecord = {
  id: string;
  motherId: string;
  calvingDate: Date;
  breedingDate: Date | null;
  estimatedBreeding: boolean;
  linkedMotherId: string | null;
  qualification: string;
  previousCalvings: number;
  conflictingBreedings: number;
};

export type GestationResult = GestationRecord & {
  durationDays: number | null;
  category: "PRIMIPARE" | "MULTIPARE";
  exclusion: string | null;
};

const DAY_MS = 86_400_000;
const MIN_PLAUSIBLE_DAYS = 250;
const MAX_PLAUSIBLE_DAYS = 320;

export function classifyGestation(record: GestationRecord): GestationResult {
  const category = record.previousCalvings === 0 ? "PRIMIPARE" : "MULTIPARE";
  const durationDays = record.breedingDate
    ? Math.round((Date.UTC(record.calvingDate.getUTCFullYear(), record.calvingDate.getUTCMonth(), record.calvingDate.getUTCDate()) -
      Date.UTC(record.breedingDate.getUTCFullYear(), record.breedingDate.getUTCMonth(), record.breedingDate.getUTCDate())) / DAY_MS)
    : null;
  let exclusion: string | null = null;
  if (record.qualification === "AVORTEMENT") exclusion = "Avortement";
  else if (!record.breedingDate || !record.linkedMotherId) exclusion = "Saillie ou gestation non liée";
  else if (record.linkedMotherId !== record.motherId) exclusion = "Mère incohérente";
  else if (record.estimatedBreeding) exclusion = "Date de saillie estimée";
  else if (record.conflictingBreedings > 0) exclusion = "Autre saillie possible dans le cycle";
  else if (durationDays === null || durationDays < MIN_PLAUSIBLE_DAYS || durationDays > MAX_PLAUSIBLE_DAYS) exclusion = "Durée hors plage de contrôle (250–320 j)";
  return { ...record, category, durationDays, exclusion };
}

export function summarizeGestations(rows: GestationResult[]) {
  const included = rows.filter((row) => row.exclusion === null && row.durationDays !== null);
  const values = included.map((row) => row.durationDays as number);
  return {
    total: rows.length,
    included: included.length,
    excluded: rows.length - included.length,
    mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    primipares: summarizeGroup(included.filter((row) => row.category === "PRIMIPARE")),
    multipares: summarizeGroup(included.filter((row) => row.category === "MULTIPARE")),
  };
}

function summarizeGroup(rows: GestationResult[]) {
  return {
    count: rows.length,
    mean: rows.length ? rows.reduce((sum, row) => sum + (row.durationDays ?? 0), 0) / rows.length : null,
  };
}

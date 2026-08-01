import type { FieldSessionEntry } from "./field-weighing";
import { parsePriceGroups, type PriceGroup } from "./price-simulation.ts";

export type StoredFieldSession = {
  startedAt: string;
  entries: FieldSessionEntry[];
  summaryOpen: boolean;
  simulationOpen: boolean;
  priceGroups: PriceGroup[];
};

export const FIELD_SESSION_STORAGE_KEY = "cesam:field-weighing-session";

export function createFieldSession(now: Date = new Date()): StoredFieldSession {
  return {
    startedAt: now.toISOString(),
    entries: [],
    summaryOpen: false,
    simulationOpen: false,
    priceGroups: [],
  };
}

function parseEntry(value: unknown): FieldSessionEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<FieldSessionEntry>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.nutrav !== "string" ||
    (entry.sexe !== "M" && entry.sexe !== "F") ||
    !Number.isInteger(entry.poids) ||
    Number(entry.poids) <= 0 ||
    (entry.gmq !== null && (typeof entry.gmq !== "number" || !Number.isFinite(entry.gmq)))
  ) return null;

  const parsedEntry: FieldSessionEntry = {
    id: entry.id,
    nutrav: entry.nutrav,
    sexe: entry.sexe,
    poids: Number(entry.poids),
    gmq: entry.gmq,
    selected: entry.selected !== false,
  };
  if (typeof entry.mereNutrav === "string" || entry.mereNutrav === null) {
    parsedEntry.mereNutrav = entry.mereNutrav;
  }
  if (entry.birthDate === null) {
    parsedEntry.birthDate = null;
  } else if (
    typeof entry.birthDate === "string" &&
    !Number.isNaN(new Date(entry.birthDate).getTime())
  ) {
    parsedEntry.birthDate = entry.birthDate;
  }
  return parsedEntry;
}

export function parseStoredFieldSession(
  value: string | null,
  now: Date = new Date(),
): StoredFieldSession {
  if (!value) return createFieldSession(now);

  try {
    const parsed = JSON.parse(value) as Partial<StoredFieldSession>;
    const startedAt = new Date(String(parsed.startedAt ?? ""));
    const seenIds = new Set<string>();
    const seenAnimals = new Set<string>();
    const entries = (Array.isArray(parsed.entries) ? parsed.entries : [])
      .map(parseEntry)
      .filter((entry): entry is FieldSessionEntry => {
        if (!entry || seenIds.has(entry.id) || seenAnimals.has(entry.nutrav)) return false;
        seenIds.add(entry.id);
        seenAnimals.add(entry.nutrav);
        return true;
      });
    const entryIds = new Set(entries.map((entry) => entry.id));
    const groupedIds = new Set<string>();
    const priceGroups = parsePriceGroups(JSON.stringify(parsed.priceGroups ?? []))
      .map((group) => {
        const peseeIds = group.peseeIds.filter((id) => {
          if (!entryIds.has(id) || groupedIds.has(id)) return false;
          groupedIds.add(id);
          return true;
        });
        return { ...group, peseeIds };
      })
      .filter((group) => group.peseeIds.length > 0);

    return {
      startedAt: Number.isNaN(startedAt.getTime()) ? now.toISOString() : startedAt.toISOString(),
      entries,
      summaryOpen: parsed.summaryOpen === true,
      simulationOpen: parsed.simulationOpen === true,
      priceGroups,
    };
  } catch {
    return createFieldSession(now);
  }
}

export function removeFieldSessionEntry(
  session: StoredFieldSession,
  id: string,
): StoredFieldSession {
  return {
    ...session,
    entries: session.entries.filter((entry) => entry.id !== id),
    priceGroups: session.priceGroups
      .map((group) => ({
        ...group,
        peseeIds: group.peseeIds.filter((peseeId) => peseeId !== id),
      }))
      .filter((group) => group.peseeIds.length > 0),
  };
}

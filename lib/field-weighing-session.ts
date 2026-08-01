import type { FieldSessionEntry } from "./field-weighing";
import { parsePriceGroups, type PriceGroup } from "./price-simulation.ts";

export type StoredFieldSession = {
  weighingSessionId: string | null;
  startedAt: string;
  status: "ACTIVE" | "FINISHED" | "ABANDONED";
  entries: FieldSessionEntry[];
  pendingWeights: PendingFieldWeight[];
  summaryOpen: boolean;
  simulationOpen: boolean;
  priceGroups: PriceGroup[];
};

export type PendingFieldWeight = {
  localId: string;
  nutrav: string;
  poids: number;
  date: string;
};

export const FIELD_SESSION_STORAGE_KEY = "cesam:field-weighing-session";

export function createFieldSession(
  now: Date = new Date(),
  weighingSessionId: string | null = null,
): StoredFieldSession {
  return {
    weighingSessionId,
    startedAt: now.toISOString(),
    status: "ACTIVE",
    entries: [],
    pendingWeights: [],
    summaryOpen: false,
    simulationOpen: false,
    priceGroups: [],
  };
}

export function canStartNewFieldSession(status: StoredFieldSession["status"]): boolean {
  return status === "FINISHED" || status === "ABANDONED";
}

function parsePendingWeight(value: unknown): PendingFieldWeight | null {
  if (!value || typeof value !== "object") return null;
  const pending = value as Partial<PendingFieldWeight>;
  if (
    typeof pending.localId !== "string" ||
    typeof pending.nutrav !== "string" ||
    !Number.isInteger(pending.poids) ||
    Number(pending.poids) <= 0 ||
    typeof pending.date !== "string"
  ) return null;
  return {
    localId: pending.localId,
    nutrav: pending.nutrav,
    poids: Number(pending.poids),
    date: pending.date,
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
      weighingSessionId: typeof parsed.weighingSessionId === "string"
        ? parsed.weighingSessionId
        : null,
      startedAt: Number.isNaN(startedAt.getTime()) ? now.toISOString() : startedAt.toISOString(),
      status: parsed.status === "FINISHED" || parsed.status === "ABANDONED"
        ? parsed.status
        : "ACTIVE",
      entries,
      pendingWeights: (Array.isArray(parsed.pendingWeights) ? parsed.pendingWeights : [])
        .map(parsePendingWeight)
        .filter((pending): pending is PendingFieldWeight => Boolean(pending)),
      summaryOpen: parsed.summaryOpen === true,
      simulationOpen: parsed.simulationOpen === true,
      priceGroups,
    };
  } catch {
    return createFieldSession(now);
  }
}

export function mergeServerEntries(
  session: StoredFieldSession,
  serverEntries: FieldSessionEntry[],
): StoredFieldSession {
  const localById = new Map(session.entries.map((entry) => [entry.id, entry]));
  const entries = serverEntries.map((entry) => ({
    ...entry,
    selected: localById.get(entry.id)?.selected ?? entry.selected,
  }));
  const entryIds = new Set(entries.map((entry) => entry.id));
  return {
    ...session,
    entries,
    priceGroups: session.priceGroups
      .map((group) => ({
        ...group,
        peseeIds: group.peseeIds.filter((id) => entryIds.has(id)),
      }))
      .filter((group) => group.peseeIds.length > 0),
  };
}

export function addPendingWeight(
  session: StoredFieldSession,
  pending: PendingFieldWeight,
): StoredFieldSession {
  if (
    session.entries.some((entry) => entry.nutrav === pending.nutrav) ||
    session.pendingWeights.some((entry) => entry.nutrav === pending.nutrav)
  ) return session;
  return { ...session, pendingWeights: [...session.pendingWeights, pending] };
}

export function resolvePendingWeight(
  session: StoredFieldSession,
  localId: string,
  entry: FieldSessionEntry,
): StoredFieldSession {
  return {
    ...session,
    entries: session.entries.some((current) => current.id === entry.id)
      ? session.entries
      : [entry, ...session.entries],
    pendingWeights: session.pendingWeights.filter((pending) => pending.localId !== localId),
  };
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

import type { FieldSessionEntry } from "./field-weighing";

export type PriceMode = "PER_KG" | "PER_HEAD";

export type PriceGroup = {
  id: string;
  sexe: "M" | "F";
  peseeIds: string[];
  mode: PriceMode;
  tarif: number;
};

export type PriceGroupStats = {
  animalCount: number;
  totalWeight: number;
  averageWeight: number;
  totalEstimate: number;
  averageEstimate: number;
};

export function sortEntriesByWeight(entries: FieldSessionEntry[]): FieldSessionEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.poids - a.entry.poids || a.index - b.index)
    .map(({ entry }) => entry);
}

export function individualEstimate(
  poids: number,
  mode: PriceMode,
  tarif: number,
): number {
  return mode === "PER_KG" ? poids * tarif : tarif;
}

export function groupEntries(
  group: PriceGroup,
  entries: FieldSessionEntry[],
): FieldSessionEntry[] {
  const ids = new Set(group.peseeIds);
  return sortEntriesByWeight(entries.filter((entry) => ids.has(entry.id)));
}

export function groupStats(
  group: PriceGroup,
  entries: FieldSessionEntry[],
): PriceGroupStats {
  const animals = groupEntries(group, entries);
  const totalWeight = animals.reduce((sum, entry) => sum + entry.poids, 0);
  const totalEstimate = animals.reduce(
    (sum, entry) => sum + individualEstimate(entry.poids, group.mode, group.tarif),
    0,
  );
  return {
    animalCount: animals.length,
    totalWeight,
    averageWeight: animals.length ? Math.round(totalWeight / animals.length) : 0,
    totalEstimate,
    averageEstimate: animals.length ? totalEstimate / animals.length : 0,
  };
}

export function groupForEntry(groups: PriceGroup[], entryId: string): PriceGroup | null {
  return groups.find((group) => group.peseeIds.includes(entryId)) ?? null;
}

export function assignPriceGroup(groups: PriceGroup[], nextGroup: PriceGroup): PriceGroup[] {
  const movingIds = new Set(nextGroup.peseeIds);
  const withoutMovedAnimals = groups
    .filter((group) => group.id !== nextGroup.id)
    .map((group) => ({
      ...group,
      peseeIds: group.peseeIds.filter((id) => !movingIds.has(id)),
    }))
    .filter((group) => group.peseeIds.length > 0);
  return [...withoutMovedAnimals, nextGroup];
}

export function removePriceGroup(groups: PriceGroup[], groupId: string): PriceGroup[] {
  return groups.filter((group) => group.id !== groupId);
}

export function sexTotals(
  groups: PriceGroup[],
  entries: FieldSessionEntry[],
  sexe: "M" | "F",
): PriceGroupStats {
  const sexGroups = groups.filter((group) => group.sexe === sexe);
  return sexGroups.reduce<PriceGroupStats>(
    (total, group) => {
      const stats = groupStats(group, entries);
      return {
        animalCount: total.animalCount + stats.animalCount,
        totalWeight: total.totalWeight + stats.totalWeight,
        averageWeight: 0,
        totalEstimate: total.totalEstimate + stats.totalEstimate,
        averageEstimate: 0,
      };
    },
    { animalCount: 0, totalWeight: 0, averageWeight: 0, totalEstimate: 0, averageEstimate: 0 },
  );
}

export function generalEstimate(groups: PriceGroup[], entries: FieldSessionEntry[]): number {
  return groups.reduce((sum, group) => sum + groupStats(group, entries).totalEstimate, 0);
}

export function parsePriceInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return parsed > 0 ? parsed : null;
}

export function serializePriceGroups(groups: PriceGroup[]): string {
  return JSON.stringify(groups);
}

export function parsePriceGroups(value: string): PriceGroup[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((group): group is PriceGroup => {
      if (!group || typeof group !== "object") return false;
      const candidate = group as Partial<PriceGroup>;
      return (
        typeof candidate.id === "string" &&
        (candidate.sexe === "M" || candidate.sexe === "F") &&
        Array.isArray(candidate.peseeIds) &&
        candidate.peseeIds.every((id) => typeof id === "string") &&
        (candidate.mode === "PER_KG" || candidate.mode === "PER_HEAD") &&
        typeof candidate.tarif === "number" &&
        candidate.tarif > 0
      );
    });
  } catch {
    return [];
  }
}

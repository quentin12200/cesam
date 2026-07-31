import type { FieldSessionEntry } from "./field-weighing";

export function sectionUiState(animalCount: number, selectedCount: number) {
  return {
    empty: animalCount === 0,
    showSelectionActions: animalCount > 0,
    showPriceAction: selectedCount > 0,
  };
}

export function selectHeaviestThrough(
  sortedEntries: FieldSessionEntry[],
  index: number,
): string[] {
  return sortedEntries.slice(0, index + 1).map((entry) => entry.id);
}

export function emptySectionLabel(sexe: "M" | "F"): string {
  return sexe === "M" ? "Aucun mâle dans cette séance" : "Aucune femelle dans cette séance";
}

import { addMonths, differenceInDays, differenceInMonths } from "date-fns";

export type PreviousWeight = {
  poids: number;
  date: Date;
};

export type FieldSessionEntry = {
  id: string;
  nutrav: string;
  mereNutrav?: string | null;
  birthDate?: string | null;
  sexe: "M" | "F";
  poids: number;
  gmq: number | null;
  selected: boolean;
};

export function motherNumberLabel(entry: Pick<FieldSessionEntry, "mereNutrav">): string {
  return entry.mereNutrav ? `Mère ${entry.mereNutrav}` : "Mère inconnue";
}

export function fieldAgeInfo(
  birthDate: string | null | undefined,
  referenceDate: Date = new Date(),
): { label: string; alert: "approaching" | "exceeded" | null } {
  if (!birthDate) return { label: "Âge inconnu", alert: null };

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime()) || birth > referenceDate) {
    return { label: "Âge inconnu", alert: null };
  }

  const totalMonths = differenceInMonths(referenceDate, birth);
  if (totalMonths >= 12) {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return {
      label: `${years} an${years > 1 ? "s" : ""} ${months} mois`,
      alert: "exceeded",
    };
  }

  const days = differenceInDays(referenceDate, addMonths(birth, totalMonths));
  return {
    label: `${totalMonths} mois ${days} j`,
    alert: totalMonths >= 11 ? "approaching" : null,
  };
}

export function ageAlertLabel(alert: ReturnType<typeof fieldAgeInfo>["alert"]): string | null {
  if (alert === "approaching") return "⚠ Approche 12 mois";
  if (alert === "exceeded") return "⚠ 12 mois dépassés";
  return null;
}

export function fieldAgeAlertSummary(
  entries: Array<Pick<FieldSessionEntry, "birthDate">>,
  referenceDate: Date = new Date(),
): { approaching: number; exceeded: number } {
  return entries.reduce(
    (summary, entry) => {
      const alert = fieldAgeInfo(entry.birthDate, referenceDate).alert;
      if (alert) summary[alert] += 1;
      return summary;
    },
    { approaching: 0, exceeded: 0 },
  );
}

export const SWIPE_ACTION_WIDTH = 192;
export const SWIPE_OPEN_THRESHOLD = 72;
export const SWIPE_CLOSE_THRESHOLD = 12;

export function calculateGmqKgPerDay(
  currentWeight: number,
  currentDate: Date,
  previous: PreviousWeight | null,
): number | null {
  if (!previous) return null;

  const elapsedDays =
    (currentDate.getTime() - previous.date.getTime()) / (24 * 60 * 60 * 1000);
  if (elapsedDays <= 0) return null;

  return Math.round(((currentWeight - previous.poids) / elapsedDays) * 10) / 10;
}

export function selectedAverage(
  entries: Array<{ poids: number; selected: boolean }>,
): number | null {
  const selected = entries.filter((entry) => entry.selected);

  return averageWeight(selected);
}

export function averageWeight(entries: Array<{ poids: number }>): number | null {
  if (entries.length === 0) return null;

  return Math.round(
    entries.reduce((total, entry) => total + entry.poids, 0) / entries.length,
  );
}

export function clampSwipeOffset(offset: number): number {
  return Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, offset));
}

export function settleSwipe(offset: number, startOffset = 0): boolean {
  if (startOffset === -SWIPE_ACTION_WIDTH) {
    return offset - startOffset < SWIPE_CLOSE_THRESHOLD;
  }
  return offset <= -SWIPE_OPEN_THRESHOLD;
}

export function replaceSessionEntry(
  entries: FieldSessionEntry[],
  updated: FieldSessionEntry,
): FieldSessionEntry[] {
  return entries.map((entry) => (entry.id === updated.id ? updated : entry));
}

export function prependSessionEntry(
  entries: FieldSessionEntry[],
  entry: FieldSessionEntry,
): FieldSessionEntry[] {
  return [entry, ...entries];
}

export function removeSessionEntry(
  entries: FieldSessionEntry[],
  id: string,
): FieldSessionEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

export function nextOpenSwipeId(
  currentId: string | null,
  requestedId: string,
  open: boolean,
): string | null {
  if (!open) return currentId === requestedId ? null : currentId;
  return requestedId;
}

export function shouldShowSwipeHint(hasUsedSwipeActions: boolean, index: number): boolean {
  return !hasUsedSwipeActions && index === 0;
}

export function stopSwipeActionPointerDown(event: { stopPropagation: () => void }): void {
  event.stopPropagation();
}

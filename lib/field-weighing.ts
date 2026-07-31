export type PreviousWeight = {
  poids: number;
  date: Date;
};

export type FieldSessionEntry = {
  id: string;
  nutrav: string;
  sexe: "M" | "F";
  poids: number;
  gmq: number | null;
  selected: boolean;
};

export const SWIPE_ACTION_WIDTH = 192;
export const SWIPE_OPEN_THRESHOLD = 72;

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
  if (selected.length === 0) return null;

  return Math.round(
    selected.reduce((total, entry) => total + entry.poids, 0) / selected.length,
  );
}

export function clampSwipeOffset(offset: number): number {
  return Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, offset));
}

export function settleSwipe(offset: number): boolean {
  return offset <= -SWIPE_OPEN_THRESHOLD;
}

export function replaceSessionEntry(
  entries: FieldSessionEntry[],
  updated: FieldSessionEntry,
): FieldSessionEntry[] {
  return entries.map((entry) => (entry.id === updated.id ? updated : entry));
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

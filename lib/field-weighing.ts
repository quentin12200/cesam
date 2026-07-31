export type PreviousWeight = {
  poids: number;
  date: Date;
};

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

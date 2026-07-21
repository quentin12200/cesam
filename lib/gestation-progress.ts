import { addDays, differenceInCalendarDays, subDays } from "date-fns";

export const GESTATION_REFERENCE_DAYS = 285;

export function formatGestationElapsed(days: number): string {
  const safeDays = Math.max(0, Math.floor(days));
  if (safeDays < 60) return `${safeDays} ${safeDays === 1 ? "jour" : "jours"}`;

  const months = Math.floor(safeDays / 30);
  const remainingDays = safeDays % 30;
  const monthsLabel = `${months} mois`;

  if (remainingDays === 0) return monthsLabel;
  return `${monthsLabel} et ${remainingDays} ${remainingDays === 1 ? "jour" : "jours"}`;
}

export function getGestationProgress(
  startDate: Date | null,
  dueDate: Date | null,
  today: Date = new Date()
) {
  if (!startDate && !dueDate) return null;

  const start = startDate ?? subDays(dueDate!, GESTATION_REFERENCE_DAYS);
  const due = dueDate ?? addDays(start, GESTATION_REFERENCE_DAYS);
  const totalDays = Math.max(1, differenceInCalendarDays(due, start));
  const elapsedDays = Math.max(0, differenceInCalendarDays(today, start));
  const remainingDays = differenceInCalendarDays(due, today);
  const percentage = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

  return { elapsedDays, remainingDays, percentage };
}

import { differenceInCalendarDays } from "date-fns";

export interface ReproductionSummaryBreeding {
  id: string;
  date: Date;
  type: string;
  gestation?: {
    dateEcho?: Date | null;
    resultatEcho?: string | null;
  } | null;
}

export interface CurrentReproductionSummary {
  lastCalving: Date | null;
  daysSinceLastCalving: number | null;
  lastEcho: {
    date: Date;
    result: string | null;
  } | null;
  lastAttempt: {
    id: string;
    date: Date;
    type: string;
    daysSince: number;
  } | null;
}

function elapsedDays(date: Date, now: Date): number {
  return Math.max(0, differenceInCalendarDays(now, date));
}

export function getCurrentReproductionSummary(
  breedings: ReproductionSummaryBreeding[],
  lastCalving: Date | null,
  now = new Date(),
): CurrentReproductionSummary {
  const cycleBreedings = breedings
    .filter((breeding) => !lastCalving || breeding.date.getTime() > lastCalving.getTime())
    .sort((left, right) => right.date.getTime() - left.date.getTime());

  const lastAttempt = cycleBreedings[0] ?? null;
  const lastEcho = cycleBreedings
    .filter((breeding) => {
      const echoDate = breeding.gestation?.dateEcho;
      return Boolean(echoDate && (!lastCalving || echoDate.getTime() > lastCalving.getTime()));
    })
    .sort(
      (left, right) =>
        right.gestation!.dateEcho!.getTime() - left.gestation!.dateEcho!.getTime(),
    )[0] ?? null;

  return {
    lastCalving,
    daysSinceLastCalving: lastCalving ? elapsedDays(lastCalving, now) : null,
    lastEcho: lastEcho?.gestation?.dateEcho
      ? {
          date: lastEcho.gestation.dateEcho,
          result: lastEcho.gestation.resultatEcho ?? null,
        }
      : null,
    lastAttempt: lastAttempt
      ? {
          id: lastAttempt.id,
          date: lastAttempt.date,
          type: lastAttempt.type,
          daysSince: elapsedDays(lastAttempt.date, now),
        }
      : null,
  };
}

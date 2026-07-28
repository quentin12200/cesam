const DAY_MS = 24 * 60 * 60 * 1000;

export interface HeatReturnMonitoringRule {
  enabled: boolean;
  startDay: number;
  endDay: number;
}

export interface HeatReturnHeat {
  id?: string;
  date: Date;
}

export interface HeatReturnBreeding {
  date: Date;
  gestation?: {
    etat?: string | null;
  } | null;
}

export interface HeatReturnReminder<T extends HeatReturnHeat = HeatReturnHeat> {
  heat: T;
  day: number;
  hasBreedingAfterHeat: boolean;
}

export function getHeatReturnReminder<T extends HeatReturnHeat>(
  heatsNewestFirst: T[],
  breedings: HeatReturnBreeding[],
  lastCalving: Date | null,
  rule: HeatReturnMonitoringRule,
  now = new Date(),
  confirmedPregnant = false
): HeatReturnReminder<T> | null {
  if (!rule.enabled || confirmedPregnant) return null;

  const latestHeat = heatsNewestFirst
    .filter((heat) =>
      heat.date.getTime() <= now.getTime()
      && (!lastCalving || heat.date.getTime() > lastCalving.getTime())
    )
    .sort((left, right) => right.date.getTime() - left.date.getTime())[0];
  if (!latestHeat) return null;

  const currentCycleBreedings = breedings.filter(
    (breeding) => !lastCalving || breeding.date.getTime() > lastCalving.getTime()
  );
  if (currentCycleBreedings.some((breeding) => breeding.gestation?.etat === "VERT")) {
    return null;
  }

  const day = Math.floor((now.getTime() - latestHeat.date.getTime()) / DAY_MS);
  if (day < rule.startDay || day > rule.endDay) return null;

  return {
    heat: latestHeat,
    day,
    hasBreedingAfterHeat: currentCycleBreedings.some(
      (breeding) => breeding.date.getTime() >= latestHeat.date.getTime()
    ),
  };
}

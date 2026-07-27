const ACTIVE_HEAT_WINDOW_MS = 48 * 60 * 60 * 1000;

type DatedEvent = { date: Date; createdAt?: Date };

export function getActiveHeat(
  heats: DatedEvent[],
  breedings: DatedEvent[],
  now = new Date()
): DatedEvent | null {
  const latestHeat = heats
    .filter((heat) => heat.date.getTime() <= now.getTime())
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  if (!latestHeat) return null;
  if (now.getTime() - latestHeat.date.getTime() >= ACTIVE_HEAT_WINDOW_MS) return null;

  const hasLaterBreeding = breedings.some(
    (breeding) =>
      breeding.date.getTime() > latestHeat.date.getTime() ||
      (breeding.createdAt?.getTime() ?? 0) > latestHeat.date.getTime()
  );
  return hasLaterBreeding ? null : latestHeat;
}

export function activeHeatSince(now = new Date()) {
  return new Date(now.getTime() - ACTIVE_HEAT_WINDOW_MS);
}

export interface DatedBreeding {
  id: string;
  date: Date;
}

export function getCurrentCycleBreeding<T extends DatedBreeding>(
  breedingsNewestFirst: T[],
  lastCalving: Date | null
): T | null {
  return breedingsNewestFirst.find(
    (breeding) => !lastCalving || breeding.date.getTime() > lastCalving.getTime()
  ) ?? null;
}

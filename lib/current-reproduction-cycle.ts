export interface DatedBreeding {
  id: string;
  date: Date;
  gestation?: {
    etat?: string | null;
    dateEcho?: Date | null;
  } | null;
}

export function getCurrentCycleBreeding<T extends DatedBreeding>(
  breedingsNewestFirst: T[],
  lastCalving: Date | null
): T | null {
  const currentCycleBreedings = breedingsNewestFirst.filter(
    (breeding) => !lastCalving || breeding.date.getTime() > lastCalving.getTime()
  );

  // Une échographie positive rattache explicitement la gestation à sa tentative
  // fécondante, même si une autre tentative plus récente est conservée à l'historique.
  return currentCycleBreedings.find((breeding) => breeding.gestation?.etat === "VERT")
    ?? currentCycleBreedings[0]
    ?? null;
}

/** A backdated calving must not erase a later manual decision or breeding. */
export function shouldResetReproductionAtCalving(calving: Date, lastCalving: Date | null, laterBreeding: Date | null, manualModifiedAt: Date | null): boolean {
  const day = calving.toISOString().slice(0, 10);
  return (!lastCalving || lastCalving.toISOString().slice(0, 10) <= day)
    && (!laterBreeding || laterBreeding.toISOString().slice(0, 10) <= day)
    && (!manualModifiedAt || manualModifiedAt.toISOString().slice(0, 10) <= day);
}
export const automaticReproductionReset = { reproductionEtatManuel: null, reproductionEtatPrecedent: null, reproductionEtatModifieAt: null } as const;
export function effectiveManualReproduction<T extends string>(manual: T | null, modifiedAt: Date | null, lastCalving: Date | null): T | null {
  if (!lastCalving || !manual || !["VERT", "ROSE"].includes(manual)) return manual;
  return modifiedAt && modifiedAt.toISOString().slice(0,10) > lastCalving.toISOString().slice(0,10) ? manual : null;
}

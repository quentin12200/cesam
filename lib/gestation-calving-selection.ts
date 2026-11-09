export interface GestationCandidate {
  id: string;
  etat: string;
  createdAt: Date;
  saillie: { date: Date };
}

/**
 * Select only a confirmed pregnancy belonging to the current reproductive
 * cycle. Previous calvings close earlier cycles; historical pregnancies stay
 * untouched. Ambiguous candidates must not be guessed.
 */
export function selectGestationForCalving<T extends GestationCandidate>(
  candidates: T[],
  calvingDate: Date,
  previousCalvingDate: Date | null = null,
): T | null {
  if (Number.isNaN(calvingDate.getTime()) || (previousCalvingDate && Number.isNaN(previousCalvingDate.getTime()))) return null;
  const confirmed = candidates.filter(candidate =>
    candidate.etat === "VERT"
    && !Number.isNaN(candidate.saillie.date.getTime())
    && candidate.saillie.date.getTime() <= calvingDate.getTime()
    && (!previousCalvingDate || candidate.saillie.date.getTime() > previousCalvingDate.getTime())
  );
  return confirmed.length === 1 ? confirmed[0] : null;
}

export interface GestationCandidate {
  id: string;
  etat: string;
  createdAt: Date;
  saillie: { date: Date };
}

/**
 * A calving can only be linked automatically to one explicitly confirmed
 * pregnancy. GRIS/ROSE are not proof of conception; multiple VERT records
 * are inconsistent and must be reconciled, never silently guessed.
 */
export function selectGestationForCalving<T extends GestationCandidate>(
  candidates: T[],
  calvingDate: Date,
): T | null {
  if (Number.isNaN(calvingDate.getTime())) return null;
  const confirmed = candidates.filter((candidate) =>
    candidate.etat === "VERT"
    && !Number.isNaN(candidate.saillie.date.getTime())
    && candidate.saillie.date.getTime() <= calvingDate.getTime()
  );
  return confirmed.length === 1 ? confirmed[0] : null;
}

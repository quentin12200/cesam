export interface GestationCandidate {
  id: string;
  createdAt: Date;
  saillie: { date: Date };
}
/**
 * Choose the most recent breeding on or before calving.
 * Never use the record creation timestamp as the biological chronology.
 */
export function selectGestationForCalving<T extends GestationCandidate>(
  candidates: T[],
  calvingDate: Date,
): T | null {
  if (Number.isNaN(calvingDate.getTime())) return null;
  const eligible = candidates.filter((candidate) =>
    !Number.isNaN(candidate.saillie.date.getTime())
    && candidate.saillie.date.getTime() <= calvingDate.getTime()
  );
  eligible.sort((a, b) =>
    b.saillie.date.getTime() - a.saillie.date.getTime()
    || b.createdAt.getTime() - a.createdAt.getTime()
  );
  return eligible[0] ?? null;
}

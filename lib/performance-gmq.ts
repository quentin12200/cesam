export type PeseeGmq = { date: Date; poids: number };
export function calculerGmq(pesees: PeseeGmq[]): number | null {
  if (pesees.length < 2) return null;
  const ordered = [...pesees].sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = ordered[0], last = ordered[ordered.length - 1];
  const jours = (last.date.getTime() - first.date.getTime()) / 86400000;
  if (!Number.isFinite(jours) || jours <= 0 || !Number.isFinite(first.poids) || !Number.isFinite(last.poids)) return null;
  return Math.round((last.poids - first.poids) / jours * 1000);
}
export function comparerGmqParPere(veaux: { pereNom: string | null; gmq: number | null }[]) {
  const groupes = new Map<string, { total: number; count: number }>();
  for (const { pereNom, gmq } of veaux) {
    if (!pereNom?.trim() || gmq === null || !Number.isFinite(gmq)) continue;
    const key = pereNom.trim();
    const group = groupes.get(key) ?? { total: 0, count: 0 };
    group.total += gmq; group.count++;
    groupes.set(key, group);
  }
  return [...groupes].map(([pereNom, group]) => ({ pereNom, nombreVeaux: group.count, gmqMoyen: Math.round(group.total / group.count) })).sort((a,b) => b.gmqMoyen - a.gmqMoyen);
}

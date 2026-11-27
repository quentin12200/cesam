export type Calf = {
  id: string; numero: string; nom: string | null; naissance: string; sexe: string;
  mereId: string; mere: string; pereId: string | null; pereNational: string | null;
  pere: string | null; fatherSource: string | null; fatherMissing: string[]; pesees: { date: string; poids: number }[];
};
export type Period = "12" | "24" | "year" | "all";
export type AgeBand = "all" | "0-3" | "3-6" | "6-9" | "9-12";
export type Group = "couples" | "meres" | "peres";
export type Row = { key: string; label: string; url?: string; total: number; born: number; gmqs: number[]; calves: { numero: string; gmq: number; pere: string | null; fatherSource: string | null; fatherMissing: string[] }[] };
const norm = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
export const average = (values: number[]) => values.length ? Math.round(values.reduce((a,b) => a+b,0)/values.length) : null;
export function calculateCalfGmq(pesees: Calf["pesees"], naissance?: string, ageBand: AgeBand = "all"): number | null {
  const valid = pesees.filter(p => Number.isFinite(p.poids) && p.poids > 0 && Number.isFinite(new Date(p.date).getTime()))
    .sort((a,b) => new Date(a.date).getTime()-new Date(b.date).getTime());
  const band = ageBand === "all" ? valid : valid.filter(p => {
    if (!naissance) return false;
    const months = (new Date(p.date).getTime()-new Date(naissance).getTime()) / (86400000 * 30.4375);
    const [min,max] = ageBand.split("-").map(Number);
    return months >= min && months < max;
  });
  if (band.length < 2) return null;
  const days = (new Date(band[band.length-1].date).getTime() - new Date(band[0].date).getTime()) / 86400000;
  return days > 0 ? Math.round((band[band.length-1].poids - band[0].poids) / days * 1000) : null;
}
function parentKey(c: Calf) {
  // Prefer stable national identity, then the registered bull ID, then normalized name.
  // Do not group an unidentified father with a known bull.
  return c.pereNational ? `nat:${norm(c.pereNational)}` : c.pereId ? `id:${c.pereId}` : c.pere ? `nom:${norm(c.pere)}` : "unknown";
}
export function makeGroups(calves: { calf: Calf; gmq: number }[], group: Group, born: Calf[]): Row[] {
  const map = new Map<string,Row>();
  for (const {calf,gmq} of calves) {
    const father = parentKey(calf);
    const key = group === "meres" ? calf.mereId : group === "peres" ? father : `${calf.mereId}:${father}`;
    const label = group === "meres" ? calf.mere : group === "peres" ? calf.pere ?? "Père inconnu" : `${calf.mere} × ${calf.pere ?? "Père inconnu"}`;
    const row = map.get(key) ?? { key, label, url: group === "meres" ? `/troupeau/${calf.mere.split(" · ")[0]}` : undefined, total: 0, born: 0, gmqs: [], calves: [] };
    row.total++; row.gmqs.push(gmq); row.calves.push({numero:calf.numero,gmq,pere:calf.pere,fatherSource:calf.fatherSource,fatherMissing:calf.fatherMissing});
    map.set(key,row);
  }
  for (const calf of born) {
    const father = parentKey(calf);
    const key = group === "meres" ? calf.mereId : group === "peres" ? father : `${calf.mereId}:${father}`;
    const row = map.get(key);
    if (row) row.born++;
  }
  return [...map.values()].sort((a,b)=>(average(b.gmqs)??-Infinity)-(average(a.gmqs)??-Infinity));
}

export function summarizeGmq(veaux: Calf[], period: Period, year: string, ageBand: AgeBand, now = new Date()) {
    const cutoff = new Date(now);
    if (period === "12" || period === "24") cutoff.setMonth(cutoff.getMonth()-Number(period));
    const selected = veaux.filter(c=>{
      const born = new Date(c.naissance);
      return period === "all" || (period === "year" ? born.getFullYear() === Number(year) : born >= cutoff && born <= now);
    });
    const measured = selected.flatMap(c=>{const gmq=calculateCalfGmq(c.pesees,c.naissance,ageBand);return gmq===null?[]:[{calf:c,gmq}];});
    return { selected:selected.length, born:selected, measured, male:measured.filter(x=>x.calf.sexe==="M"), female:measured.filter(x=>x.calf.sexe==="F") };
 }

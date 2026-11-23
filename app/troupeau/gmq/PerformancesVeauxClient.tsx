"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Calf = {
  id: string; numero: string; nom: string | null; naissance: string; sexe: string;
  mereId: string; mere: string; pereId: string | null; pereNational: string | null;
  pere: string | null; pesees: { date: string; poids: number }[];
};
type Period = "12" | "24" | "year" | "all";
type Group = "couples" | "meres" | "peres";
type Row = { key: string; label: string; url?: string; total: number; gmqs: number[]; calves: { numero: string; gmq: number }[] };
const norm = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
const average = (values: number[]) => values.length ? Math.round(values.reduce((a,b) => a+b,0)/values.length) : null;
const fmt = (n: number | null) => n === null ? "—" : `${n.toLocaleString("fr-FR")} g/j`;
export function calculateCalfGmq(pesees: Calf["pesees"]): number | null {
  const valid = pesees.filter(p => Number.isFinite(p.poids) && p.poids > 0 && Number.isFinite(new Date(p.date).getTime()))
    .sort((a,b) => new Date(a.date).getTime()-new Date(b.date).getTime());
  if (valid.length < 2) return null;
  const days = (new Date(valid[valid.length-1].date).getTime() - new Date(valid[0].date).getTime()) / 86400000;
  return days > 0 ? Math.round((valid[valid.length-1].poids - valid[0].poids) / days * 1000) : null;
}
function parentKey(c: Calf) {
  // Prefer stable national identity, then the registered bull ID, then normalized name.
  // Do not group an unidentified father with a known bull.
  return c.pereNational ? `nat:${norm(c.pereNational)}` : c.pereId ? `id:${c.pereId}` : c.pere ? `nom:${norm(c.pere)}` : "unknown";
}
function makeGroups(calves: { calf: Calf; gmq: number }[], group: Group): Row[] {
  const map = new Map<string,Row>();
  for (const {calf,gmq} of calves) {
    const father = parentKey(calf);
    const key = group === "meres" ? calf.mereId : group === "peres" ? father : `${calf.mereId}:${father}`;
    const label = group === "meres" ? calf.mere : group === "peres" ? calf.pere ?? "Père inconnu" : `${calf.mere} × ${calf.pere ?? "Père inconnu"}`;
    const row = map.get(key) ?? { key, label, url: group === "meres" ? `/troupeau/${calf.mere.split(" · ")[0]}` : undefined, total: 0, gmqs: [], calves: [] };
    row.total++; row.gmqs.push(gmq); row.calves.push({numero:calf.numero,gmq});
    map.set(key,row);
  }
  return [...map.values()].sort((a,b)=>(average(b.gmqs)??-Infinity)-(average(a.gmqs)??-Infinity));
}
export default function PerformancesVeauxClient({veaux}:{veaux:Calf[]}) {
  const [period,setPeriod] = useState<Period>("12");
  const [year,setYear] = useState(String(new Date().getFullYear()));
  const [group,setGroup] = useState<Group>("couples");
  const [expanded,setExpanded] = useState<string | null>(null);
  const years = [...new Set(veaux.map(v=>new Date(v.naissance).getFullYear()))].sort((a,b)=>b-a);
  const result = useMemo(()=>{
    const cutoff = new Date();
    if (period === "12" || period === "24") cutoff.setMonth(cutoff.getMonth()-Number(period));
    const selected = veaux.filter(c=>{
      const born = new Date(c.naissance);
      return period === "all" || (period === "year" ? born.getFullYear() === Number(year) : born >= cutoff && born <= new Date());
    });
    const measured = selected.flatMap(c=>{const gmq=calculateCalfGmq(c.pesees);return gmq===null?[]:[{calf:c,gmq}];});
    return { selected:selected.length, measured, male:measured.filter(x=>x.calf.sexe==="M"), female:measured.filter(x=>x.calf.sexe==="F") };
  },[veaux,period,year]);
  const rows = useMemo(()=>makeGroups(result.measured,group),[result.measured,group]);
  const metric = (title:string,items:typeof result.measured) => <div className="rounded-xl border bg-white p-3">
    <p className="text-xs text-gray-500">{title}</p><p className="text-xl sm:text-2xl font-bold text-green-800 mt-1">{fmt(average(items.map(x=>x.gmq)))}</p>
    <p className="text-xs text-gray-500 mt-1">{items.length} veau{items.length>1?"x":""} avec GMQ</p>
  </div>;
  return <div className="space-y-4">
    <div className="rounded-xl bg-white shadow p-3 space-y-2">
      <label htmlFor="gmq-period" className="block text-sm font-semibold">Période de naissance</label>
      <div className="flex gap-2">
        <select id="gmq-period" value={period} onChange={e=>setPeriod(e.target.value as Period)} className="flex-1 min-w-0 border rounded-lg p-2.5 text-sm bg-white">
          <option value="12">12 derniers mois</option><option value="24">24 derniers mois</option><option value="year">Année civile</option><option value="all">Tout l’historique</option>
        </select>
        {period==="year"&&<select aria-label="Année" value={year} onChange={e=>setYear(e.target.value)} className="border rounded-lg p-2 text-sm bg-white">
          {[...new Set([Number(year),...years])].sort((a,b)=>b-a).map(y=><option key={y} value={y}>{y}</option>)}
        </select>}
      </div>
      <p className="text-xs text-gray-500">{result.selected} veaux nés sur la période · {result.measured.length} avec au moins deux pesées valides. Les veaux vendus restent inclus.</p>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2">{metric("GMQ moyen · Tous les veaux",result.measured)}</div>
      {metric("♂ Mâles",result.male)}{metric("♀ Femelles",result.female)}
    </div>
    <section className="bg-white rounded-xl shadow p-3 space-y-3">
      <h2 className="font-bold text-gray-800">Classements</h2>
      <div role="group" aria-label="Type de classement" className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg">
        {([["couples","Couples"],["meres","Vaches"],["peres","Taureaux"]] as const).map(([value,label])=><button type="button" key={value} aria-pressed={group===value} onClick={()=>{setGroup(value);setExpanded(null);}} className={`rounded-md py-2.5 text-sm font-medium ${group===value?"bg-white shadow text-green-800":"text-gray-600"}`}>{label}</button>)}
      </div>
      <p className="text-xs text-gray-500">Classement par GMQ moyen décroissant. Effectif = veaux avec GMQ calculable.</p>
      {rows.length===0?<p className="py-5 text-center text-sm text-gray-500">Aucun GMQ calculable pour cette période.</p>:
        <div className="divide-y">
          {rows.map((r,i)=><div key={r.key} className="py-2">
            <button type="button" aria-expanded={expanded===r.key} onClick={()=>setExpanded(expanded===r.key?null:r.key)} className="w-full text-left flex items-center gap-2 min-h-12">
              <span className="text-xs text-gray-400 w-5 shrink-0">{i+1}.</span>
              <span className="flex-1 min-w-0"><span className="block text-sm font-semibold text-gray-800 break-words">{r.label}</span><span className="text-xs text-gray-500">{r.total} veau{r.total>1?"x":""} pesé{r.total>1?"s":""}{r.total===1?" · résultat indicatif":""}</span></span>
              <span className="font-bold text-green-800 whitespace-nowrap text-sm">{fmt(average(r.gmqs))}</span><span className="text-gray-400 text-xs">{expanded===r.key?"−":"+"}</span>
            </button>
            {expanded===r.key&&<div className="ml-7 mt-2 bg-gray-50 rounded-lg p-2 space-y-1">
              {r.url&&<Link href={r.url} className="text-xs text-green-800 underline">Voir la fiche de la vache</Link>}
              {r.calves.map(c=><div key={c.numero} className="flex justify-between gap-2 text-sm"><Link href={`/troupeau/${c.numero}`} className="underline text-green-800">Veau {c.numero}</Link><span>{fmt(c.gmq)}</span></div>)}
            </div>}
          </div>)}
        </div>}
    </section>
    <p className="text-xs text-gray-500 px-1">GMQ = (dernière pesée − première pesée) ÷ jours écoulés × 1 000. Un veau compte une seule fois. Les âges et périodes de pesée peuvent différer : ces classements décrivent la croissance observée, pas la valeur génétique. Aucun animal ni pesée n’est modifié.</p>
  </div>;
}

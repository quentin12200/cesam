"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { average, makeGroups, summarizeGmq } from "@/lib/gmq-rankings";
import type { Calf, Period, AgeBand, Group } from "@/lib/gmq-rankings";
const fmt = (n: number | null) => n === null ? "—" : `${n.toLocaleString("fr-FR")} g/j`;
export default function PerformancesVeauxClient({veaux}:{veaux:Calf[]}) {
  const [period,setPeriod] = useState<Period>("12");
  const [year,setYear] = useState(String(new Date().getFullYear()));
  const [group,setGroup] = useState<Group>("couples");
  const [ageBand,setAgeBand] = useState<AgeBand>("all");
  const [expanded,setExpanded] = useState<string | null>(null);
  const years = [...new Set(veaux.map(v=>new Date(v.naissance).getFullYear()))].sort((a,b)=>b-a);
  const result = useMemo(()=>{
    return summarizeGmq(veaux,period,year,ageBand);
  },[veaux,period,year,ageBand]);
  const rows = useMemo(()=>makeGroups(result.measured,group,result.born),[result.measured,group,result.born]);
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
    <div className="rounded-xl bg-white shadow p-3 space-y-2"><label htmlFor="gmq-age" className="block text-sm font-semibold">Âge des veaux au moment des pesées</label><select id="gmq-age" value={ageBand} onChange={e=>setAgeBand(e.target.value as AgeBand)} className="w-full border rounded-lg p-2.5 text-sm bg-white"><option value="all">GMQ global (toutes pesées)</option><option value="0-3">0 à 3 mois</option><option value="3-6">3 à 6 mois</option><option value="6-9">6 à 9 mois</option><option value="9-12">9 à 12 mois</option></select><p className="text-xs text-gray-500">Par tranche, deux pesées réelles au minimum dans la tranche. Aucune estimation entre les tranches.</p></div>
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2">{metric("GMQ moyen · Tous les veaux",result.measured)}</div>
      {metric("♂ Mâles",result.male)}{metric("♀ Femelles",result.female)}
    </div>
    <section className="bg-white rounded-xl shadow p-3 space-y-3">
      <h2 className="font-bold text-gray-800">Classements</h2>
      <div role="group" aria-label="Type de classement" className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg">
        {([["couples","Couples"],["meres","Vaches"],["peres","Taureaux"]] as const).map(([value,label])=><button type="button" key={value} aria-pressed={group===value} onClick={()=>{setGroup(value);setExpanded(null);}} className={`rounded-md py-2.5 text-sm font-medium ${group===value?"bg-white shadow text-green-800":"text-gray-600"}`}>{label}</button>)}
      </div>
      <p className="text-xs text-gray-500">Classement par GMQ moyen décroissant. Effectif : veaux avec GMQ calculable / veaux recensés sur la période.</p>
      {rows.length===0?<p className="py-5 text-center text-sm text-gray-500">Aucun GMQ calculable pour cette période.</p>:
        <div className="divide-y">
          {rows.map((r,i)=><div key={r.key} className="py-2">
            <button type="button" aria-expanded={expanded===r.key} onClick={()=>setExpanded(expanded===r.key?null:r.key)} className="w-full text-left flex items-center gap-2 min-h-12">
              <span className="text-xs text-gray-400 w-5 shrink-0">{i+1}.</span>
              <span className="flex-1 min-w-0"><span className="block text-sm font-semibold text-gray-800 break-words">{r.label}</span><span className="text-xs text-gray-500">{r.total} / {r.born} veaux avec GMQ{r.total===1?" · résultat indicatif":""}</span></span>
              <span className="font-bold text-green-800 whitespace-nowrap text-sm">{fmt(average(r.gmqs))}</span><span className="text-gray-400 text-xs">{expanded===r.key?"−":"+"}</span>
            </button>
            {expanded===r.key&&<div className="ml-7 mt-2 bg-gray-50 rounded-lg p-2 space-y-1">
              {r.url&&<Link href={r.url} className="text-xs text-green-800 underline">Voir la fiche de la vache</Link>}
              {r.calves.map(c=><div key={c.numero} className="border-t border-gray-200 pt-2 first:border-0 first:pt-0 space-y-1">
                <div className="flex justify-between gap-2 text-sm"><Link href={`/troupeau/${c.numero}`} className="underline text-green-800">Veau {c.numero}</Link><span>{fmt(c.gmq)}</span></div>
                <p className="text-xs text-gray-600">Filiation paternelle : {c.fatherSource ?? "aucune source identifiée"}{c.pere ? ` · ${c.pere}` : ""}</p>
                {!c.fatherSource && <p className="text-xs font-medium text-amber-800">Père inconnu : {c.fatherMissing.join(" ; ")}</p>}
              </div>)}
            </div>}
          </div>)}
        </div>}
    </section>
    <p className="text-xs text-gray-500 px-1">GMQ = (dernière pesée − première pesée de la sélection) ÷ jours écoulés × 1 000. Un veau compte une seule fois. Les âges et périodes de pesée peuvent différer : ces classements décrivent la croissance observée, pas la valeur génétique. Aucun animal ni pesée n’est modifié.</p>
  </div>;
}

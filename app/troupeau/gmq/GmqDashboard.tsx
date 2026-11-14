"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { GrowthPoint, GrowthReference, DeathMarker } from "../[nutrav]/DescendantGrowthChart";

type Props = { points: GrowthPoint[]; reference: GrowthReference[]; deaths: DeathMarker[] };
const COLORS = { sold: "#15803d", retained: "#db2777", deceased: "#dc2626" };
const labels = { sold: "Autres veaux", retained: "Renouvellement", deceased: "Veaux morts" };
const age = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default function GmqDashboard({ points, reference, deaths }: Props) {
  const [sex, setSex] = useState<"ALL" | "M" | "F">("ALL");
  const [groups, setGroups] = useState({ sold: true, retained: true, deceased: true });
  const [chosen, setChosen] = useState<{ number: string; detail: string } | null>(null);
  const active = (group: keyof typeof groups) => groups[group];
  const filtered = useMemo(() => points.filter(p => (sex === "ALL" || p.sex === sex) && active(p.deceased ? "deceased" : p.retained ? "retained" : "sold") && p.ageMonths >= 0 && p.ageMonths <= 13), [points, sex, groups]);
  const dead = deaths.filter(d => (sex === "ALL" || d.sex === sex) && active("deceased") && d.ageMonths >= 0 && d.ageMonths <= 13);
  const curves = (["sold", "retained", "deceased"] as const).filter(active).map(group => {
    const rows = reference.filter(r => r.group === group && (sex === "ALL" || r.sex === sex));
    const months = [...new Set(rows.map(r => r.month))].sort((a,b) => a-b);
    return { group, values: months.map(month => {
      const samples = rows.filter(r => r.month === month);
      const count = samples.reduce((n,r) => n+r.count,0);
      return { month, kg: count ? samples.reduce((n,r) => n+r.kg*r.count,0)/count : 0, count };
    }).filter(v => v.count >= 2 && v.month >= 0 && v.month <= 13) };
  });
  const maxKg = Math.max(100, ...filtered.map(p => p.kg), ...curves.flatMap(c => c.values.map(v => v.kg)));
  const x = (m: number) => 46 + m / 13 * 646;
  const y = (kg: number) => 264 - kg / (maxKg * 1.1) * 234;
  const unique = new Set(filtered.map(p => p.id)).size;
  const latest = new Map<string, GrowthPoint>();
  for (const p of filtered) if (!latest.has(p.id) || latest.get(p.id)!.ageMonths < p.ageMonths) latest.set(p.id,p);
  const average = latest.size ? Math.round([...latest.values()].reduce((n,p) => n+p.kg,0)/latest.size) : null;
  return <section className="rounded-xl bg-white shadow p-3 sm:p-5 space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div><h3 className="font-bold text-gray-800 text-base sm:text-lg">Croissance des veaux</h3><p className="text-xs text-gray-500">Pesées réelles · de 0 à 13 mois</p></div>
      <div className="flex rounded-lg bg-gray-100 p-1 gap-1" role="group" aria-label="Filtrer par sexe">
        {([["ALL","Tous"],["M","Mâles"],["F","Femelles"]] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={sex===value} onClick={() => {setSex(value);setChosen(null);}} className={`flex-1 sm:flex-none px-3 py-2 rounded-md text-xs sm:text-sm font-medium ${sex===value ? "bg-green-700 text-white shadow-sm" : "text-gray-700"}`}>{label}</button>)}
      </div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      <Metric value={unique.toLocaleString("fr-FR")} label="Veaux avec pesée" />
      <Metric value={average===null ? "—" : `${average} kg`} label="Dernier poids moyen" />
      <Metric value={new Set(filtered.filter(p=>p.retained && !p.deceased).map(p=>p.id)).size.toString()} label="Renouvellement pesé" />
      <Metric value={dead.length.toString()} label="Décès avant 13 mois" />
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Catégories visibles">
      {(["sold","retained","deceased"] as const).map(group => <button key={group} type="button" aria-pressed={active(group)} onClick={()=>{setGroups(v=>({...v,[group]:!v[group]}));setChosen(null);}} className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-xs sm:text-sm ${active(group) ? "bg-gray-50 border-gray-300 text-gray-800" : "bg-white border-gray-200 text-gray-400"}`}><span className="inline-block w-2.5 h-2.5 rounded-full" style={{background: active(group) ? COLORS[group] : "#d1d5db"}} />{labels[group]}</button>)}
    </div>
    <div className="rounded-lg border border-gray-100 bg-white">
      <svg viewBox="0 0 720 300" className="block w-full h-auto" role="img" aria-label="Graphique des poids individuels par âge, moyennes par catégorie et décès">
        {[0,.25,.5,.75,1].map(f => <g key={f}><line x1="46" x2="692" y1={y(maxKg*f)} y2={y(maxKg*f)} stroke="#e5e7eb"/><text x="39" y={y(maxKg*f)+4} textAnchor="end" fontSize="12" fill="#6b7280">{Math.round(maxKg*f)}</text></g>)}
        {[0,3,6,9,13].map(m => <text key={m} x={x(m)} y="286" fontSize="12" textAnchor="middle" fill="#6b7280">{m}</text>)}
        <text x="8" y="15" fontSize="12" fill="#6b7280">kg</text><text x="645" y="298" fontSize="12" fill="#6b7280">mois</text>
        {curves.map(c => c.values.length > 1 && <polyline key={c.group} points={c.values.map(v=>`${x(v.month)},${y(v.kg)}`).join(" ")} fill="none" stroke={COLORS[c.group]} strokeWidth="3" strokeDasharray="7 5" opacity=".65"/>)}
        {filtered.map((p,i) => <circle key={`${p.id}-${i}`} cx={x(p.ageMonths)} cy={y(p.kg)} r="5" fill={COLORS[p.deceased?"deceased":p.retained?"retained":"sold"]} opacity=".8" stroke="white" strokeWidth="1" role="button" tabIndex={0} aria-label={`${p.number} : ${p.kg} kg à ${age(p.ageMonths)} mois`} onClick={()=>setChosen({number:p.number,detail:`${p.kg} kg à ${age(p.ageMonths)} mois · ${p.source}`})} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")setChosen({number:p.number,detail:`${p.kg} kg à ${age(p.ageMonths)} mois · ${p.source}`});}}/>)}
        {dead.map(d => <g key={d.id} role="button" tabIndex={0} aria-label={`Décès ${d.number} à ${age(d.ageMonths)} mois`} onClick={()=>setChosen({number:d.number,detail:`Décès à ${age(d.ageMonths)} mois · Cause : ${d.cause||"Non renseignée"}`})} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")setChosen({number:d.number,detail:`Décès à ${age(d.ageMonths)} mois · Cause : ${d.cause||"Non renseignée"}`});}}><line x1={x(d.ageMonths)-7} x2={x(d.ageMonths)+7} y1="250" y2="264" stroke="#dc2626" strokeWidth="3"/><line x1={x(d.ageMonths)-7} x2={x(d.ageMonths)+7} y1="264" y2="250" stroke="#dc2626" strokeWidth="3"/></g>)}
      </svg>
    </div>
    <p className="text-xs text-gray-500">Points : pesées et poids vifs de vente connus. Pointillés : moyennes (au moins 2 veaux par âge). Croix rouges sur l'axe : âge au décès. Aucune valeur manquante n'est estimée.</p>
    {chosen && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm"><Link href={`/troupeau/${chosen.number}`} className="font-bold text-green-800 underline">{chosen.number}</Link><span className="text-gray-700"> · {chosen.detail}</span></div>}
    {filtered.length===0 && dead.length===0 && <p className="text-sm text-gray-500">Aucune donnée pour cette sélection.</p>}
  </section>;
}
function Metric({value,label}:{value:string;label:string}){return <div className="rounded-xl bg-gray-50 p-3 sm:p-4"><div className="text-xl sm:text-2xl font-bold text-green-800">{value}</div><div className="text-xs text-gray-600 mt-1">{label}</div></div>}

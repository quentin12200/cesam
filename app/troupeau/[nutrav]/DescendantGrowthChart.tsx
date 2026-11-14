"use client";

import { useState } from "react";
import Link from "next/link";

export type GrowthPoint = { id: string; number: string; sex: string; ageMonths: number; kg: number; retained: boolean; deceased?: boolean; source: string };
export type DeathMarker = { id: string; number: string; sex: string; ageMonths: number; cause: string | null };
export type GrowthReference = { group: string; sex: string; month: number; kg: number; count: number };

export default function DescendantGrowthChart({ points, reference, deaths = [], title = "Croissance des descendants · 0 à 13 mois" }: { points: GrowthPoint[]; reference: GrowthReference[]; deaths?: DeathMarker[]; title?: string }) {
  const [group, setGroup] = useState<"sold" | "retained" | "deceased">("sold");
  const [sex, setSex] = useState<"M" | "F" | "ALL">("ALL");
  const [selected, setSelected] = useState<GrowthPoint | null>(null);
  const visible = points.filter((p) => (group === "deceased" ? p.deceased === true : p.deceased !== true && p.retained === (group === "retained")) && (sex === "ALL" || p.sex === sex) && p.ageMonths >= 0 && p.ageMonths <= 13);
  const visibleDeaths = deaths.filter((d) => (sex === "ALL" || d.sex === sex) && d.ageMonths >= 0 && d.ageMonths <= 13);
  const [selectedDeath, setSelectedDeath] = useState<DeathMarker | null>(null);
  const sourceBaseline = reference.filter((r) => r.group === group && (sex === "ALL" || r.sex === sex) && r.month >= 0 && r.month <= 13);
  const baseline = [...new Set(sourceBaseline.map((r) => r.month))].map((month) => {
    const rows = sourceBaseline.filter((r) => r.month === month);
    const count = rows.reduce((sum, r) => sum + r.count, 0);
    return { month, count, kg: rows.reduce((sum, r) => sum + r.kg * r.count, 0) / count };
  }).filter((r) => r.count >= 2).sort((a, b) => a.month - b.month);
  const maxKg = Math.max(100, ...visible.map((p) => p.kg), ...baseline.map((r) => r.kg));
  const x = (months: number) => 40 + (months / 13) * 295;
  const y = (kg: number) => 195 - (kg / (maxKg * 1.1)) * 175;
  return (
    <section className="rounded-xl bg-white p-3 sm:p-5 shadow space-y-3">
      <h3 className="font-semibold text-gray-800">{title}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={group === "sold"} onClick={() => { setGroup("sold"); setSelected(null); }} className={`rounded-lg px-3 py-2 text-sm ${group === "sold" ? "bg-green-700 text-white" : "bg-gray-100"}`}>Autres veaux</button>
        <button type="button" aria-pressed={group === "retained"} onClick={() => { setGroup("retained"); setSex("F"); setSelected(null); }} className={`rounded-lg px-3 py-2 text-sm ${group === "retained" ? "bg-green-700 text-white" : "bg-gray-100"}`}>Renouvellement</button>
        <button type="button" aria-pressed={group === "deceased"} onClick={() => { setGroup("deceased"); setSelected(null); }} className={`rounded-lg px-3 py-2 text-sm ${group === "deceased" ? "bg-red-700 text-white" : "bg-gray-100"}`}>Veaux morts</button>
        {<select aria-label="Sexe des veaux" value={sex} onChange={(e) => { setSex(e.target.value as "M" | "F" | "ALL"); setSelected(null); }} className="rounded-lg border px-2 py-2 text-xs sm:text-sm"><option value="ALL">Mâles et femelles</option><option value="M">Mâles</option><option value="F">Femelles</option></select>}
      </div>
      <svg viewBox="0 0 350 225" role="img" aria-label="Poids vif en kg selon âge en mois, points des descendants et moyenne du troupeau" className="w-full max-h-[420px]">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => <g key={fraction}><line x1="40" x2="335" y1={y(maxKg * fraction)} y2={y(maxKg * fraction)} stroke="#e5e7eb"/><text x="34" y={y(maxKg * fraction) + 3} textAnchor="end" fontSize="10" fill="#64748b">{Math.round(maxKg * fraction)}</text></g>)}
        {[0, 3, 6, 9, 13].map((month) => <text key={month} x={x(month)} y="213" fontSize="10" textAnchor="middle" fill="#64748b">{month}</text>)}
        <text x="8" y="12" fontSize="10" fill="#64748b">kg vif</text>
        <text x="280" y="224" fontSize="10" fill="#64748b">mois</text>
        {baseline.length > 1 && <polyline points={baseline.map((r) => `${x(r.month)},${y(r.kg)}`).join(" ")} fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="5 4"/>}
        {visibleDeaths.map((d) => <g key={`death-${d.id}`} role="button" tabIndex={0} aria-label={`${d.number} mort à ${d.ageMonths.toFixed(1)} mois`} onClick={() => { setSelectedDeath(d); setSelected(null); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setSelectedDeath(d); setSelected(null); } }}><line x1={x(d.ageMonths)-6} y1="189" x2={x(d.ageMonths)+6} y2="201" stroke="#dc2626" strokeWidth="3"/><line x1={x(d.ageMonths)-6} y1="201" x2={x(d.ageMonths)+6} y2="189" stroke="#dc2626" strokeWidth="3"/></g>)}
        {visible.map((p, index) => <circle key={`${p.id}-${p.ageMonths}-${index}`} cx={x(p.ageMonths)} cy={y(p.kg)} r="5.5" fill={p.deceased ? "#b91c1c" : p.retained ? "#db2777" : "#15803d"} stroke="white" strokeWidth="1.5" tabIndex={0} role="button" aria-label={`${p.number}, ${p.kg} kg à ${p.ageMonths.toFixed(1)} mois`} onClick={() => setSelected(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected(p); }}/>)}
      </svg>
      <p className="text-xs text-gray-500">Croix rouges sur l’axe, visibles dans toutes les catégories : âge au décès (même sans pesée) · Points rouges : pesées des veaux morts, conservées dans l’historique · Autres points : pesées et poids de vente vifs connus · Pointillés : moyenne du troupeau par âge et sexe (au moins 2 mesures). Les données absentes ne sont pas estimées.</p>
      {visible.length === 0 && visibleDeaths.length === 0 && <p className="text-sm text-gray-500">Aucune pesée disponible pour cette sélection.</p>}
      {selectedDeath && <p className="text-sm rounded-lg bg-red-50 p-2"><Link className="font-semibold text-red-700 underline" href={`/troupeau/${selectedDeath.number}`}>{selectedDeath.number}</Link> · Mort à {selectedDeath.ageMonths.toFixed(1)} mois · Cause : {selectedDeath.cause || "Non renseignée"}</p>}
      {selected && <p className="text-sm rounded-lg bg-gray-50 p-2"><Link className="font-semibold text-green-700 underline" href={`/troupeau/${selected.number}`}>{selected.number}</Link> · {selected.kg} kg à {selected.ageMonths.toFixed(1)} mois · {selected.source}</p>}
    </section>
  );
}

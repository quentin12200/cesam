"use client";

import { useState, useMemo } from "react";
import type { GestationRecord } from "../performances/gestation/types";

type FiltreAnnee = number | "TOUS";
type FiltreSexe = "M" | "F" | "TOUS";
type FiltreType = "IA" | "TAUREAU" | "TOUS";
type FiltreAge = "<3" | "3-5" | "5-8" | ">8" | "TOUS";
type VueGesta = "resume" | "vaches";

function avg(arr: number[]): number | null {
  if (!arr.length) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${active ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
    >
      {label}
    </button>
  );
}

function MiniBarChart({ data }: { data: { label: string; value: number | null; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.value ?? 0), 1);
  const min = Math.min(...data.filter((d) => d.value != null).map((d) => d.value!));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20 shrink-0">{d.label}</span>
          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
            {d.value != null && (
              <div
                className={`h-full rounded transition-all ${d.value === min ? "bg-green-500" : d.value === max ? "bg-amber-400" : "bg-green-300"}`}
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            )}
          </div>
          <span className="text-xs font-bold text-gray-700 w-14 text-right shrink-0">
            {d.value != null ? `${d.value}j` : "—"} {d.count > 0 && <span className="font-normal text-gray-400">({d.count})</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function LineChartGesta({ parAnnee }: { parAnnee: { annee: number; moyenne: number | null; count: number }[] }) {
  const W = 500; const H = 120;
  const PAD = { top: 12, right: 16, bottom: 24, left: 40 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const vals = parAnnee.map((d) => d.moyenne).filter((v): v is number => v != null);
  const [hovered, setHovered] = useState<{ x: number; label: string; val: string } | null>(null);
  if (vals.length < 2) return <p className="text-xs text-gray-400 text-center py-4">Pas assez de données pour un graphique</p>;
  const minV = Math.min(...vals) - 2;
  const maxV = Math.max(...vals) + 2;
  const range = maxV - minV || 1;
  const n = parAnnee.length;
  const xPos = (i: number) => PAD.left + (i / Math.max(n - 1, 1)) * cW;
  const yPos = (v: number) => PAD.top + cH - ((v - minV) / range) * cH;

  const pts = parAnnee.map((d, i) => d.moyenne != null ? `${xPos(i)},${yPos(d.moyenne)}` : null).filter(Boolean);
  const path = pts.length > 1 ? `M ${pts.join(" L ")}` : null;

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`} className="w-full"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rx = ((e.clientX - rect.left) / rect.width) * W;
          const idx = Math.round(((rx - PAD.left) / cW) * (n - 1));
          if (idx < 0 || idx >= n || parAnnee[idx].moyenne == null) { setHovered(null); return; }
          setHovered({ x: xPos(idx), label: String(parAnnee[idx].annee), val: `${parAnnee[idx].moyenne}j (${parAnnee[idx].count} vêl.)` });
        }}
        onMouseLeave={() => setHovered(null)}
      >
        {[0, 0.5, 1].map((f) => {
          const y = PAD.top + cH * (1 - f);
          const val = minV + range * f;
          return (
            <g key={f}>
              <line x1={PAD.left} x2={PAD.left + cW} y1={y} y2={y} stroke="#f0f0f0" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize="8" fill="#9ca3af">{val.toFixed(0)}j</text>
            </g>
          );
        })}
        {parAnnee.map((d, i) => (
          <text key={d.annee} x={xPos(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#6b7280">{d.annee}</text>
        ))}
        {path && <path d={path} fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {parAnnee.map((d, i) => d.moyenne != null ? (
          <circle key={i} cx={xPos(i)} cy={yPos(d.moyenne)} r="4" fill="#15803d" stroke="white" strokeWidth="1.5" />
        ) : null)}
        {hovered && <line x1={hovered.x} x2={hovered.x} y1={PAD.top} y2={PAD.top + cH} stroke="#374151" strokeWidth="1" strokeDasharray="3,2" />}
      </svg>
      {hovered && (
        <div className="absolute top-0 right-0 bg-white border border-gray-200 rounded-lg shadow px-3 py-2 text-xs pointer-events-none">
          <div className="font-bold text-gray-700">{hovered.label}</div>
          <div className="text-green-700">{hovered.val}</div>
        </div>
      )}
    </div>
  );
}

export default function GestationStats({ records }: { records: GestationRecord[] }) {
  const [filtreAnnee, setFiltreAnnee] = useState<FiltreAnnee>("TOUS");
  const [filtreSexe, setFiltreSexe] = useState<FiltreSexe>("TOUS");
  const [filtreType, setFiltreType] = useState<FiltreType>("TOUS");
  const [filtreAge, setFiltreAge] = useState<FiltreAge>("TOUS");
  const [vue, setVue] = useState<VueGesta>("resume");
  const [sortVaches, setSortVaches] = useState<"count" | "moy">("count");

  const annees = useMemo(() => [...new Set(records.map((r) => r.annee))].sort((a, b) => b - a), [records]);

  const filtered = useMemo(() => records.filter((r) => {
    if (filtreAnnee !== "TOUS" && r.annee !== filtreAnnee) return false;
    if (filtreSexe !== "TOUS" && r.sexeVeau !== filtreSexe) return false;
    if (filtreType !== "TOUS" && r.typeSaillie !== filtreType) return false;
    if (filtreAge !== "TOUS") {
      if (filtreAge === "<3" && r.ageMereAnnees >= 3) return false;
      if (filtreAge === "3-5" && (r.ageMereAnnees < 3 || r.ageMereAnnees > 5)) return false;
      if (filtreAge === "5-8" && (r.ageMereAnnees < 5 || r.ageMereAnnees > 8)) return false;
      if (filtreAge === ">8" && r.ageMereAnnees <= 8) return false;
    }
    return true;
  }), [records, filtreAnnee, filtreSexe, filtreType, filtreAge]);

  const moyenneGlobale = avg(filtered.map((r) => r.duree));

  const parAnnee = useMemo(() => {
    const map = new Map<number, number[]>();
    filtered.forEach((r) => { if (!map.has(r.annee)) map.set(r.annee, []); map.get(r.annee)!.push(r.duree); });
    return [...annees].reverse().map((a) => ({ annee: a, moyenne: avg(map.get(a) ?? []), count: map.get(a)?.length ?? 0 }));
  }, [filtered, annees]);

  const parSaison = useMemo(() => {
    const saisons = ["Printemps", "Été", "Automne", "Hiver"] as const;
    return saisons.map((s) => {
      const vals = filtered.filter((r) => r.saison === s).map((r) => r.duree);
      return { label: s, value: avg(vals), count: vals.length };
    });
  }, [filtered]);

  const parSexe = useMemo(() => {
    const m = filtered.filter((r) => r.sexeVeau === "M").map((r) => r.duree);
    const f = filtered.filter((r) => r.sexeVeau === "F").map((r) => r.duree);
    return { m: avg(m), f: avg(f), mCount: m.length, fCount: f.length };
  }, [filtered]);

  const parType = useMemo(() => {
    const ia = filtered.filter((r) => r.typeSaillie === "IA").map((r) => r.duree);
    const t = filtered.filter((r) => r.typeSaillie === "TAUREAU").map((r) => r.duree);
    return { ia: avg(ia), taureau: avg(t), iaCount: ia.length, taureauCount: t.length };
  }, [filtered]);

  const parTrancheAge = useMemo(() => [
    { label: "< 3 ans", value: avg(filtered.filter((r) => r.ageMereAnnees < 3).map((r) => r.duree)), count: filtered.filter((r) => r.ageMereAnnees < 3).length },
    { label: "3–5 ans", value: avg(filtered.filter((r) => r.ageMereAnnees >= 3 && r.ageMereAnnees <= 5).map((r) => r.duree)), count: filtered.filter((r) => r.ageMereAnnees >= 3 && r.ageMereAnnees <= 5).length },
    { label: "5–8 ans", value: avg(filtered.filter((r) => r.ageMereAnnees > 5 && r.ageMereAnnees <= 8).map((r) => r.duree)), count: filtered.filter((r) => r.ageMereAnnees > 5 && r.ageMereAnnees <= 8).length },
    { label: "> 8 ans", value: avg(filtered.filter((r) => r.ageMereAnnees > 8).map((r) => r.duree)), count: filtered.filter((r) => r.ageMereAnnees > 8).length },
  ], [filtered]);

  const parVache = useMemo(() => {
    const map = new Map<string, { nom: string | null; durees: number[] }>();
    filtered.forEach((r) => {
      if (!map.has(r.mereNutrav)) map.set(r.mereNutrav, { nom: r.mereNom, durees: [] });
      map.get(r.mereNutrav)!.durees.push(r.duree);
    });
    return [...map.entries()].map(([nutrav, { nom, durees }]) => ({
      nutrav, nom,
      count: durees.length,
      moy: avg(durees)!,
      min: Math.min(...durees),
      max: Math.max(...durees),
    })).sort((a, b) => sortVaches === "count" ? b.count - a.count : b.moy - a.moy);
  }, [filtered, sortVaches]);

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="bg-white rounded-xl shadow px-4 py-3 space-y-2">
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-gray-600">Année</span>
            <Pill label="Toutes" active={filtreAnnee === "TOUS"} onClick={() => setFiltreAnnee("TOUS")} />
            {annees.map((a) => <Pill key={a} label={String(a)} active={filtreAnnee === a} onClick={() => setFiltreAnnee(a)} />)}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-600">Sexe veau</span>
            <Pill label="Tous" active={filtreSexe === "TOUS"} onClick={() => setFiltreSexe("TOUS")} />
            <Pill label="♂ Mâle" active={filtreSexe === "M"} onClick={() => setFiltreSexe("M")} />
            <Pill label="♀ Femelle" active={filtreSexe === "F"} onClick={() => setFiltreSexe("F")} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-600">Saillie</span>
            <Pill label="Toutes" active={filtreType === "TOUS"} onClick={() => setFiltreType("TOUS")} />
            <Pill label="IA" active={filtreType === "IA"} onClick={() => setFiltreType("IA")} />
            <Pill label="Taureau" active={filtreType === "TAUREAU"} onClick={() => setFiltreType("TAUREAU")} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-600">Âge mère</span>
            <Pill label="Tous" active={filtreAge === "TOUS"} onClick={() => setFiltreAge("TOUS")} />
            <Pill label="< 3 ans" active={filtreAge === "<3"} onClick={() => setFiltreAge("<3")} />
            <Pill label="3–5 ans" active={filtreAge === "3-5"} onClick={() => setFiltreAge("3-5")} />
            <Pill label="5–8 ans" active={filtreAge === "5-8"} onClick={() => setFiltreAge("5-8")} />
            <Pill label="> 8 ans" active={filtreAge === ">8"} onClick={() => setFiltreAge(">8")} />
          </div>
        </div>
        <div className="text-xs text-gray-400">{filtered.length} vêlage{filtered.length > 1 ? "s" : ""} analysé{filtered.length > 1 ? "s" : ""}</div>
      </div>

      {/* Onglets vue */}
      <div className="flex gap-1 bg-white rounded-xl shadow p-1 w-fit">
        <button onClick={() => setVue("resume")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${vue === "resume" ? "bg-green-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}>Résumé</button>
        <button onClick={() => setVue("vaches")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${vue === "vaches" ? "bg-green-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}>Par vache</button>
      </div>

      {vue === "resume" && (
        <div className="space-y-4">
          {/* Cartes résumé */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-3xl font-bold text-green-700">{moyenneGlobale ?? "—"}<span className="text-base font-normal text-gray-400">j</span></div>
              <div className="text-xs text-gray-500 mt-1">Durée moyenne</div>
              <div className="text-xs text-gray-400">{filtered.length} vêlages</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="flex justify-around items-end">
                <div>
                  <div className="text-xl font-bold text-blue-600">{parSexe.m ?? "—"}<span className="text-xs font-normal">j</span></div>
                  <div className="text-xs text-gray-400">♂ {parSexe.mCount}</div>
                </div>
                <div className="text-gray-300 text-xl">vs</div>
                <div>
                  <div className="text-xl font-bold text-pink-500">{parSexe.f ?? "—"}<span className="text-xs font-normal">j</span></div>
                  <div className="text-xs text-gray-400">♀ {parSexe.fCount}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">Mâle vs Femelle</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="flex justify-around items-end">
                <div>
                  <div className="text-xl font-bold text-purple-600">{parType.ia ?? "—"}<span className="text-xs font-normal">j</span></div>
                  <div className="text-xs text-gray-400">IA {parType.iaCount}</div>
                </div>
                <div className="text-gray-300 text-xl">vs</div>
                <div>
                  <div className="text-xl font-bold text-amber-600">{parType.taureau ?? "—"}<span className="text-xs font-normal">j</span></div>
                  <div className="text-xs text-gray-400">🐂 {parType.taureauCount}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">IA vs Taureau</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              {(() => {
                const best = parSaison.filter((s) => s.value != null).sort((a, b) => a.value! - b.value!)[0];
                return best ? (
                  <>
                    <div className="text-3xl font-bold text-green-700">{best.value}<span className="text-base font-normal text-gray-400">j</span></div>
                    <div className="text-xs text-gray-500 mt-1">+ court : {best.label}</div>
                  </>
                ) : <div className="text-gray-400 text-sm">—</div>;
              })()}
            </div>
          </div>

          {/* Graphique par année */}
          <div className="bg-white rounded-xl shadow p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Évolution par année</h4>
            <LineChartGesta parAnnee={parAnnee} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Par saison */}
            <div className="bg-white rounded-xl shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Par saison de vêlage</h4>
              <MiniBarChart data={parSaison} />
            </div>

            {/* Par tranche d'âge */}
            <div className="bg-white rounded-xl shadow p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Par âge de la mère</h4>
              <MiniBarChart data={parTrancheAge} />
            </div>
          </div>

          {/* Tableau par année */}
          <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Détail par année</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b">
                  <th className="pb-2 text-left">Année</th>
                  <th className="pb-2 text-center">Vêlages</th>
                  <th className="pb-2 text-center">Durée moy.</th>
                  <th className="pb-2 text-center">♂ Mâles</th>
                  <th className="pb-2 text-center">♀ Femelles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...parAnnee].reverse().map((row) => {
                  const rm = filtered.filter((r) => r.annee === row.annee && r.sexeVeau === "M").map((r) => r.duree);
                  const rf = filtered.filter((r) => r.annee === row.annee && r.sexeVeau === "F").map((r) => r.duree);
                  return (
                    <tr key={row.annee} className="hover:bg-gray-50">
                      <td className="py-2 font-semibold text-gray-800">{row.annee}</td>
                      <td className="py-2 text-center text-gray-600">{row.count}</td>
                      <td className="py-2 text-center font-bold text-green-700">{row.moyenne != null ? `${row.moyenne}j` : "—"}</td>
                      <td className="py-2 text-center text-blue-600">{avg(rm) != null ? `${avg(rm)}j` : "—"} <span className="text-gray-400 text-xs">({rm.length})</span></td>
                      <td className="py-2 text-center text-pink-500">{avg(rf) != null ? `${avg(rf)}j` : "—"} <span className="text-gray-400 text-xs">({rf.length})</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {vue === "vaches" && (
        <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Par vache individuelle</h4>
            <div className="flex gap-1">
              <button onClick={() => setSortVaches("count")} className={`px-2 py-1 rounded text-xs font-medium ${sortVaches === "count" ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600"}`}>Tri : nb vêlages</button>
              <button onClick={() => setSortVaches("moy")} className={`px-2 py-1 rounded text-xs font-medium ${sortVaches === "moy" ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600"}`}>Tri : durée</button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b">
                <th className="pb-2 text-left">Vache</th>
                <th className="pb-2 text-center">Nb vêlages</th>
                <th className="pb-2 text-center">Moy.</th>
                <th className="pb-2 text-center">Min</th>
                <th className="pb-2 text-center">Max</th>
                <th className="pb-2 text-center">Écart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {parVache.map((v) => (
                <tr key={v.nutrav} className="hover:bg-gray-50">
                  <td className="py-2">
                    <span className="font-medium text-gray-800">{v.nom ?? "—"}</span>
                    <span className="ml-1.5 text-xs text-gray-400 font-mono">{v.nutrav}</span>
                  </td>
                  <td className="py-2 text-center text-gray-600">{v.count}</td>
                  <td className="py-2 text-center font-bold text-green-700">{v.moy}j</td>
                  <td className="py-2 text-center text-blue-600">{v.min}j</td>
                  <td className="py-2 text-center text-amber-600">{v.max}j</td>
                  <td className="py-2 text-center text-gray-400 text-xs">{v.max - v.min}j</td>
                </tr>
              ))}
            </tbody>
          </table>
          {parVache.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">Aucune donnée avec ces filtres</p>}
        </div>
      )}
    </div>
  );
}

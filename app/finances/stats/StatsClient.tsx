"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Sparkles, X, Loader2 } from "lucide-react";
import type { AnneeStats } from "./page";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(curr: number, prev: number) {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

function fmtEuro(v: number | null) {
  if (v == null || v === 0) return "—";
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function fmtKg(v: number | null) {
  if (!v) return "—";
  return `${Math.round(v).toLocaleString("fr-FR")} kg`;
}

function fmtPrix(v: number | null) {
  if (!v) return "—";
  return `${v.toFixed(2)} €/kg`;
}

function Delta({ curr, prev }: { curr: number | null; prev: number | null }) {
  if (curr == null || !prev) return null;
  const val = pct(curr, prev);
  if (val === null) return null;
  if (val > 0) return (
    <span className="inline-flex items-center gap-0.5 text-green-600 text-[10px] font-semibold">
      <TrendingUp size={9} />+{val}%
    </span>
  );
  if (val < 0) return (
    <span className="inline-flex items-center gap-0.5 text-red-500 text-[10px] font-semibold">
      <TrendingDown size={9} />{val}%
    </span>
  );
  return <span className="text-gray-400 text-[10px]"><Minus size={9} className="inline" />0%</span>;
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

function LineChart({
  series,
  labels,
  colors,
  unit = "",
  height = 120,
}: {
  series: { name: string; values: (number | null)[] }[];
  labels: string[];
  colors: string[];
  unit?: string;
  height?: number;
}) {
  const W = 500;
  const H = height;
  const PAD = { top: 12, right: 16, bottom: 24, left: 44 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const allVals = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const minV = Math.min(...allVals) * 0.9;
  const maxV = Math.max(...allVals) * 1.05;
  const range = maxV - minV || 1;

  const n = labels.length;
  const xPos = (i: number) => PAD.left + (i / (n - 1)) * cW;
  const yPos = (v: number) => PAD.top + cH - ((v - minV) / range) * cH;

  const [hovered, setHovered] = useState<{ x: number; y: number; label: string; values: string[] } | null>(null);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((rx - PAD.left) / cW) * (n - 1));
    if (idx < 0 || idx >= n) { setHovered(null); return; }
    const x = xPos(idx);
    const values = series.map((s) => {
      const v = s.values[idx];
      return v != null ? `${s.name}: ${v.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}${unit}` : `${s.name}: —`;
    });
    setHovered({ x, y: H / 2, label: labels[idx], values });
  }

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = PAD.top + cH * (1 - f);
          const val = minV + range * f;
          return (
            <g key={f}>
              <line x1={PAD.left} x2={PAD.left + cW} y1={y} y2={y} stroke="#f0f0f0" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize="8" fill="#9ca3af">
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(val < 10 ? 2 : 0)}
              </text>
            </g>
          );
        })}

        {/* X labels */}
        {labels.map((l, i) => (
          <text key={l} x={xPos(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#6b7280">{l}</text>
        ))}

        {/* Lines + dots */}
        {series.map((s, si) => {
          const pts = s.values
            .map((v, i) => v != null ? `${xPos(i)},${yPos(v)}` : null)
            .filter(Boolean);
          const path = pts.length > 1 ? `M ${pts.join(" L ")}` : null;
          return (
            <g key={s.name}>
              {path && (
                <path
                  d={path}
                  fill="none"
                  stroke={colors[si]}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {s.values.map((v, i) =>
                v != null ? (
                  <circle key={i} cx={xPos(i)} cy={yPos(v)} r="4" fill={colors[si]} stroke="white" strokeWidth="1.5" />
                ) : null
              )}
            </g>
          );
        })}

        {/* Hover line */}
        {hovered && (
          <line
            x1={hovered.x} x2={hovered.x}
            y1={PAD.top} y2={PAD.top + cH}
            stroke="#374151" strokeWidth="1" strokeDasharray="3,2"
          />
        )}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div className="absolute top-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none z-10">
          <div className="font-bold text-gray-700 mb-1">{hovered.label}</div>
          {hovered.values.map((v, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i] }} />
              <span className="text-gray-600">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bar Chart (empilé) ────────────────────────────────────────────────────────

function StackedBarChart({
  data,
  labels,
  keys,
  colors,
  keyLabels,
}: {
  data: { [k: string]: number }[];
  labels: string[];
  keys: string[];
  colors: string[];
  keyLabels: string[];
}) {
  const maxVal = Math.max(...data.map((d) => keys.reduce((s, k) => s + (d[k] ?? 0), 0)), 1);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const total = keys.reduce((s, k) => s + (d[k] ?? 0), 0);
        return (
          <div key={labels[i]}
            className="flex items-center gap-2 group cursor-default"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="text-xs font-semibold text-gray-500 w-9 shrink-0 text-right">{labels[i]}</span>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden flex">
              {keys.map((k, ki) => {
                const w = total > 0 ? (d[k] ?? 0) / maxVal * 100 : 0;
                return (
                  <div
                    key={k}
                    className="h-full transition-all duration-300"
                    style={{ width: `${w}%`, background: colors[ki] }}
                  />
                );
              })}
            </div>
            <span className={`text-xs font-bold w-24 text-right shrink-0 transition-colors ${hovered === i ? "text-green-700" : "text-gray-600"}`}>
              {total > 0 ? total.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "—"}
            </span>
          </div>
        );
      })}
      <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-end">
        {keys.map((k, i) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: colors[i] }} />
            {keyLabels[i]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Analyse IA ────────────────────────────────────────────────────────────────

function AnalyseIA({ stats }: { stats: AnneeStats[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyse, setAnalyse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function lancerAnalyse() {
    setOpen(true);
    if (analyse) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/finances/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setAnalyse(data.analyse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={lancerAnalyse}
        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all"
      >
        <Sparkles size={16} />
        Analyser avec l&apos;IA
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2 text-white">
                <Sparkles size={16} />
                <span className="font-semibold text-sm">Analyse IA — CESAM</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              {loading && (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
                  <Loader2 size={28} className="animate-spin text-purple-500" />
                  <span className="text-sm">Analyse en cours…</span>
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
              )}
              {analyse && (
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                  {analyse}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Carte KPI ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, delta, color = "text-gray-800",
}: {
  label: string; value: string; sub?: string; delta?: { curr: number | null; prev: number | null }; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-3 flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
      {delta && <Delta curr={delta.curr} prev={delta.prev} />}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StatsClient({ stats }: { stats: AnneeStats[] }) {
  const anneeMax = new Date().getFullYear();
  const curr = stats.find((s) => s.annee === anneeMax) ?? stats[stats.length - 1];
  const prev = stats.find((s) => s.annee === (curr?.annee ?? 0) - 1);
  const prev2 = stats.find((s) => s.annee === (curr?.annee ?? 0) - 2);

  const labels = stats.map((s) => String(s.annee));

  return (
    <div className="space-y-5">

      {/* Bouton IA */}
      <div className="flex justify-end">
        <AnalyseIA stats={stats} />
      </div>

      {/* KPIs année courante */}
      {curr && (
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{curr.annee} — en bref</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              label="CA total"
              value={fmtEuro(curr.caTotal)}
              delta={{ curr: curr.caTotal, prev: prev?.caTotal ?? null }}
              color="text-green-700"
            />
            <KpiCard
              label="Veaux vendus"
              value={String(curr.veauxCount)}
              sub={fmtKg(curr.veauxKgTotal) + " vif"}
              delta={{ curr: curr.veauxCount, prev: prev?.veauxCount ?? null }}
            />
            <KpiCard
              label="Prix moy. veaux"
              value={fmtPrix(curr.veauxPrixMoyen)}
              delta={{ curr: curr.veauxPrixMoyen, prev: prev?.veauxPrixMoyen ?? null }}
            />
            <KpiCard
              label="Productivité"
              value={curr.tauxProductivite != null ? `${curr.tauxProductivite}%` : "—"}
              sub="veaux / vêlages"
              delta={{ curr: curr.tauxProductivite, prev: prev?.tauxProductivite ?? null }}
              color={curr.tauxProductivite != null ? curr.tauxProductivite >= 80 ? "text-green-600" : curr.tauxProductivite >= 60 ? "text-yellow-600" : "text-red-500" : "text-gray-400"}
            />
          </div>
        </div>
      )}

      {/* Graphique CA évolution */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-1">Chiffre d&apos;affaires par année</h3>
        <p className="text-xs text-gray-400 mb-3">Veaux vif + Vaches boucherie</p>
        <StackedBarChart
          data={stats.map((s) => ({ veaux: s.veauxCA, vaches: s.vachesCA }))}
          labels={labels}
          keys={["veaux", "vaches"]}
          colors={["#22c55e", "#f97316"]}
          keyLabels={["Veaux vif", "Vaches boucherie"]}
        />
      </div>

      {/* Graphique prix au kilo */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-1">Évolution du prix au kilo</h3>
        <p className="text-xs text-gray-400 mb-3">Tendance marché — veaux (€/kg vif) et vaches (€/kg carcasse)</p>
        <LineChart
          series={[
            { name: "Veaux €/kg vif", values: stats.map((s) => s.veauxPrixMoyen) },
            { name: "Vaches €/kg carc.", values: stats.map((s) => s.vachesPrixMoyen) },
          ]}
          labels={labels}
          colors={["#22c55e", "#f97316"]}
          unit=" €"
          height={130}
        />
        <div className="flex gap-4 mt-1 text-xs text-gray-500 justify-end">
          <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded inline-block bg-green-500" />Veaux vif</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded inline-block bg-orange-500" />Vaches carc.</span>
        </div>
      </div>

      {/* Graphique volumes */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-1">Volumes vendus — nombre d&apos;animaux</h3>
        <p className="text-xs text-gray-400 mb-3">Évolution du nombre de têtes vendues par année</p>
        <LineChart
          series={[
            { name: "Veaux vendus", values: stats.map((s) => s.veauxCount) },
            { name: "Vaches boucherie", values: stats.map((s) => s.vachesCount) },
          ]}
          labels={labels}
          colors={["#3b82f6", "#f59e0b"]}
          unit=""
          height={110}
        />
        <div className="flex gap-4 mt-1 text-xs text-gray-500 justify-end">
          <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded inline-block bg-blue-500" />Veaux</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded inline-block bg-amber-500" />Vaches carc.</span>
        </div>
      </div>

      {/* Graphique productivité */}
      {stats.some((s) => s.tauxProductivite != null) && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-1">Taux de productivité</h3>
          <p className="text-xs text-gray-400 mb-3">Veaux vendus / vêlages enregistrés — objectif ≥ 80%</p>
          <LineChart
            series={[
              { name: "Productivité", values: stats.map((s) => s.tauxProductivite) },
            ]}
            labels={labels}
            colors={["#8b5cf6"]}
            unit="%"
            height={110}
          />
          {/* Ligne objectif 80% en annotation */}
          <p className="text-xs text-purple-500 mt-1 text-right">Objectif : ≥ 80%</p>
        </div>
      )}

      {/* Tableau comparatif */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <h3 className="font-semibold text-gray-800 px-4 pt-4 pb-2">Tableau comparatif complet</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[560px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Indicateur</th>
                {stats.map((s) => (
                  <th key={s.annee} className={`px-3 py-2 text-center font-semibold ${s.annee === anneeMax ? "bg-green-50 text-green-700" : "text-gray-600"}`}>
                    {s.annee}{s.annee === anneeMax && <span className="block text-[10px] font-normal text-green-400">en cours</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: "🐄 Veaux vendus", fn: (s: AnneeStats) => s.veauxCount || "—", numFn: (s: AnneeStats) => s.veauxCount },
                { label: "Kg total vif", fn: (s: AnneeStats) => fmtKg(s.veauxKgTotal), numFn: (s: AnneeStats) => s.veauxKgTotal },
                { label: "Prix moy. €/kg vif", fn: (s: AnneeStats) => fmtPrix(s.veauxPrixMoyen), numFn: (s: AnneeStats) => s.veauxPrixMoyen },
                { label: "CA veaux", fn: (s: AnneeStats) => fmtEuro(s.veauxCA), numFn: (s: AnneeStats) => s.veauxCA },
                { label: "🥩 Vaches boucherie", fn: (s: AnneeStats) => s.vachesCount || "—", numFn: (s: AnneeStats) => s.vachesCount },
                { label: "Kg carcasse", fn: (s: AnneeStats) => fmtKg(s.vachesKgCarcasse), numFn: (s: AnneeStats) => s.vachesKgCarcasse },
                { label: "Prix moy. €/kg carc.", fn: (s: AnneeStats) => fmtPrix(s.vachesPrixMoyen), numFn: (s: AnneeStats) => s.vachesPrixMoyen },
                { label: "CA vaches", fn: (s: AnneeStats) => fmtEuro(s.vachesCA), numFn: (s: AnneeStats) => s.vachesCA },
                { label: "📊 CA total", fn: (s: AnneeStats) => fmtEuro(s.caTotal), numFn: (s: AnneeStats) => s.caTotal, bold: true },
                { label: "Productivité %", fn: (s: AnneeStats) => s.tauxProductivite != null ? `${s.tauxProductivite}%` : "—", numFn: (s: AnneeStats) => s.tauxProductivite },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-gray-50">
                  <td className={`px-3 py-2 text-gray-600 ${row.bold ? "font-bold" : ""}`}>{row.label}</td>
                  {stats.map((s, si) => {
                    const prev = stats[si - 1];
                    return (
                      <td key={s.annee} className={`px-3 py-2 text-center ${s.annee === anneeMax ? "bg-green-50/40" : ""}`}>
                        <span className={`block ${row.bold ? "font-bold text-green-700" : "text-gray-800"}`}>
                          {String(row.fn(s))}
                        </span>
                        {si > 0 && <Delta curr={row.numFn(s)} prev={row.numFn(prev)} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

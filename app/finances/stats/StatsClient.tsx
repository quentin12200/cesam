"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Minus, Sparkles, X, Loader2, Pencil, BarChart2, List } from "lucide-react";
import type { AnneeStats, SortieDetail, VenteHisto } from "./page";
import { CAUSES_MORTALITE, CAUSES_MORTALITE_LABELS } from "@/lib/utils";

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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
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
  series, labels, colors, unit = "", height = 120,
}: {
  series: { name: string; values: (number | null)[] }[];
  labels: string[];
  colors: string[];
  unit?: string;
  height?: number;
}) {
  const W = 500; const H = height;
  const PAD = { top: 12, right: 16, bottom: 24, left: 44 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const allVals = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const minV = Math.min(...allVals) * 0.9;
  const maxV = Math.max(...allVals) * 1.05;
  const range = maxV - minV || 1;
  const n = labels.length;
  const xPos = (i: number) => PAD.left + (i / Math.max(n - 1, 1)) * cW;
  const yPos = (v: number) => PAD.top + cH - ((v - minV) / range) * cH;
  const [hovered, setHovered] = useState<{ x: number; label: string; values: string[] } | null>(null);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((rx - PAD.left) / cW) * (n - 1));
    if (idx < 0 || idx >= n) { setHovered(null); return; }
    setHovered({
      x: xPos(idx),
      label: labels[idx],
      values: series.map((s) => {
        const v = s.values[idx];
        return v != null ? `${s.name}: ${v.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}${unit}` : `${s.name}: —`;
      }),
    });
  }

  return (
    <div className="relative select-none">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseMove={handleMouseMove} onMouseLeave={() => setHovered(null)}>
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
        {labels.map((l, i) => (
          <text key={l} x={xPos(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#6b7280">{l}</text>
        ))}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => v != null ? `${xPos(i)},${yPos(v)}` : null).filter(Boolean);
          const path = pts.length > 1 ? `M ${pts.join(" L ")}` : null;
          return (
            <g key={s.name}>
              {path && <path d={path} fill="none" stroke={colors[si]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
              {s.values.map((v, i) => v != null ? (
                <circle key={i} cx={xPos(i)} cy={yPos(v)} r="4" fill={colors[si]} stroke="white" strokeWidth="1.5" />
              ) : null)}
            </g>
          );
        })}
        {hovered && <line x1={hovered.x} x2={hovered.x} y1={PAD.top} y2={PAD.top + cH} stroke="#374151" strokeWidth="1" strokeDasharray="3,2" />}
      </svg>
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

// ── Bar Chart ────────────────────────────────────────────────────────────────

function StackedBarChart({ data, labels, keys, colors, keyLabels }: {
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
          <div key={labels[i]} className="flex items-center gap-2" onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <span className="text-xs font-semibold text-gray-500 w-9 shrink-0 text-right">{labels[i]}</span>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden flex">
              {keys.map((k, ki) => (
                <div key={k} className="h-full transition-all duration-300" style={{ width: `${total > 0 ? (d[k] ?? 0) / maxVal * 100 : 0}%`, background: colors[ki] }} />
              ))}
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

// ── Prix mensuel dans l'année ─────────────────────────────────────────────────

const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function PrixMensuelChart({ sortiesParAnnee, anneeSelectionnee }: {
  sortiesParAnnee: Record<number, SortieDetail[]>;
  anneeSelectionnee: number;
}) {
  const [annee, setAnnee] = useState(anneeSelectionnee);
  const anneesDispos = Object.keys(sortiesParAnnee).map(Number).sort((a, b) => b - a);

  const sorties = sortiesParAnnee[annee] ?? [];
  if (sorties.length === 0) return null;

  // Prix moyen veaux par mois
  const veauxParMois: { prix: number[]; count: number }[] = Array.from({ length: 12 }, () => ({ prix: [], count: 0 }));
  const vachesParMois: { prix: number[]; count: number }[] = Array.from({ length: 12 }, () => ({ prix: [], count: 0 }));

  for (const s of sorties) {
    const mois = new Date(s.date).getMonth();
    if (s.prixKilo) {
      if (s.isVeau || s.type === "ELEVAGE") veauxParMois[mois].prix.push(s.prixKilo);
      else if (s.type === "BOUCHERIE") vachesParMois[mois].prix.push(s.prixKilo);
    }
  }

  const veauxMoyens = veauxParMois.map((m) => m.prix.length ? m.prix.reduce((a, b) => a + b, 0) / m.prix.length : null);
  const vachesMoyens = vachesParMois.map((m) => m.prix.length ? m.prix.reduce((a, b) => a + b, 0) / m.prix.length : null);
  const hasData = veauxMoyens.some((v) => v !== null) || vachesMoyens.some((v) => v !== null);
  if (!hasData) return null;

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-gray-800">Variation du prix au kilo dans l&apos;année</h3>
          <p className="text-xs text-gray-400">Prix moyen mensuel — données saisies individuellement</p>
        </div>
        <div className="flex gap-1.5">
          {anneesDispos.map((a) => (
            <button key={a} onClick={() => setAnnee(a)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${a === annee ? "bg-green-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              {a}
            </button>
          ))}
        </div>
      </div>
      <LineChart
        series={[
          { name: "Veaux €/kg vif", values: veauxMoyens },
          { name: "Vaches €/kg carc.", values: vachesMoyens },
        ]}
        labels={MOIS}
        colors={["#22c55e","#f97316"]}
        unit=" €"
        height={120}
      />
      <div className="flex gap-4 mt-1 text-xs text-gray-500 justify-end">
        <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded inline-block bg-green-500" />Veaux vif</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded inline-block bg-orange-500" />Vaches carc.</span>
      </div>
    </div>
  );
}

// ── Bouton seed données historiques ──────────────────────────────────────────

function BoutonSeedHistorique({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function seed() {
    setLoading(true); setError(null);
    try {
      // 1. Appliquer les migrations manquantes
      await fetch("/api/migrate", { method: "POST" });
      // 2. Insérer les totaux annuels
      await fetch("/api/stats-annuelles/seed", { method: "POST" });
      // 3. Insérer les 274 ventes individuelles depuis l'Excel
      const res = await fetch("/api/ventes-historiques/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setDone(true);
      router.refresh();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (done) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-amber-800">Données historiques non chargées</p>
        <p className="text-xs text-amber-600">Clique pour importer 2021–2025 depuis ton Excel</p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <button onClick={seed} disabled={loading}
        className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
        {loading ? "Import…" : "Importer"}
      </button>
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
    setLoading(true); setError(null);
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
      <button onClick={lancerAnalyse} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all">
        <Sparkles size={16} />Analyser avec l&apos;IA
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2 text-white"><Sparkles size={16} /><span className="font-semibold text-sm">Analyse IA — CESAM</span></div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5">
              {loading && <div className="flex flex-col items-center py-10 gap-3 text-gray-400"><Loader2 size={28} className="animate-spin text-purple-500" /><span className="text-sm">Analyse en cours…</span></div>}
              {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
              {analyse && <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">{analyse}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Edit sortie drawer ────────────────────────────────────────────────────────

function EditDrawer({ sortie, onClose, onSaved }: { sortie: SortieDetail; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date(sortie.date).toISOString().slice(0, 10));
  const [type, setType] = useState(sortie.type);
  const [acheteur, setAcheteur] = useState(sortie.acheteur ?? "");
  const [poids, setPoids] = useState(sortie.poids?.toString() ?? "");
  const [poidsVif, setPoidsVif] = useState(sortie.poidsVif?.toString() ?? "");
  const [rendement, setRendement] = useState(sortie.rendementCarcasse?.toString() ?? "55");
  const [prixKilo, setPrixKilo] = useState(sortie.prixKilo?.toString() ?? "");
  const [prixHT, setPrixHT] = useState(sortie.prixDefinitifHT?.toString() ?? "");
  const [notes, setNotes] = useState(sortie.notes ?? "");
  const [causeMortalite, setCauseMortalite] = useState(sortie.causeMortalite ?? "");

  const isBoucherie = type === "BOUCHERIE";
  const hasFinancials = type === "ELEVAGE" || type === "BOUCHERIE";
  const poidsCarcasseCalc = isBoucherie && poidsVif && rendement ? (parseFloat(poidsVif) * parseFloat(rendement) / 100).toFixed(1) : null;
  const poidsEff = isBoucherie ? (poids || poidsCarcasseCalc || "") : poids;
  const prixCalc = prixKilo && poidsEff ? (parseFloat(prixKilo) * parseFloat(poidsEff)).toFixed(2) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/sorties/${sortie.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, type, acheteur: acheteur || null,
          poids: poids ? parseFloat(poids) : (poidsCarcasseCalc ? parseFloat(poidsCarcasseCalc) : null),
          poidsVif: isBoucherie && poidsVif ? parseFloat(poidsVif) : null,
          rendementCarcasse: isBoucherie && rendement ? parseFloat(rendement) : null,
          prixKilo: prixKilo ? parseFloat(prixKilo) : null,
          prixDefinitifHT: prixHT ? parseFloat(prixHT) : null,
          notes: notes || null,
          causeMortalite: type === "MORT" ? causeMortalite || null : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 flex items-center justify-between px-4 py-3 z-10">
          <div>
            <h3 className="font-semibold text-gray-800">Modifier la sortie</h3>
            <p className="text-xs text-gray-500">{sortie.animal.nutrav} — {sortie.animal.nobovi ?? "Sans nom"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[["ELEVAGE","Vente vif"],["BOUCHERIE","Boucherie"],["ENGRAISSEMENT","Engraissement"],["MORT","Mort"]].map(([v,l]) => (
                <button key={v} type="button" onClick={() => setType(v)}
                  className={`p-2 rounded-lg border text-sm font-medium transition-all ${type === v ? "border-green-600 bg-green-50 text-green-800" : "border-gray-200 text-gray-600"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          {type === "MORT" && (
            <div>
              <label className="block text-sm font-medium text-red-700 mb-1">Cause de mortalité</label>
              <div className="grid grid-cols-2 gap-2">
                {CAUSES_MORTALITE.map((c) => (
                  <button key={c} type="button" onClick={() => setCauseMortalite(c)}
                    className={`p-2 rounded-lg border text-sm font-medium transition-all ${causeMortalite === c ? "border-red-600 bg-red-50 text-red-800" : "border-gray-200 text-gray-600"}`}>
                    {CAUSES_MORTALITE_LABELS[c] ?? c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasFinancials && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Acheteur</label>
                <input type="text" value={acheteur} onChange={(e) => setAcheteur(e.target.value)}
                  placeholder="Nom du maquignon / abattoir…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              {isBoucherie && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-medium text-orange-700">Rendement carcasse</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Poids vif (kg)</label>
                      <input type="number" step="0.5" min="0" value={poidsVif} onChange={(e) => setPoidsVif(e.target.value)}
                        placeholder="ex: 700"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Rendement (%)</label>
                      <input type="number" step="0.5" min="0" max="100" value={rendement} onChange={(e) => setRendement(e.target.value)}
                        placeholder="ex: 55"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </div>
                  </div>
                  {poidsCarcasseCalc && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600">Carcasse calculée :</span>
                      <span className="font-bold text-orange-700">{poidsCarcasseCalc} kg</span>
                      <button type="button" onClick={() => setPoids(poidsCarcasseCalc)} className="text-xs text-orange-600 underline">Utiliser</button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isBoucherie ? "Poids carcasse (kg)" : "Poids vif (kg)"}</label>
                  <input type="number" step="0.1" min="0" value={poids} onChange={(e) => setPoids(e.target.value)}
                    placeholder={poidsCarcasseCalc ?? "ex: 280"}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix / kg (€)</label>
                  <input type="number" step="0.01" min="0" value={prixKilo} onChange={(e) => setPrixKilo(e.target.value)}
                    placeholder="ex: 3.20"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              {prixCalc && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                  <span className="text-gray-600">Prix calculé : </span>
                  <span className="font-bold text-green-700 text-base">{parseFloat(prixCalc).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix définitif HT (€)</label>
                <input type="number" step="0.01" min="0" value={prixHT} onChange={(e) => setPrixHT(e.target.value)}
                  placeholder={prixCalc ?? "ex: 850.00"}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Informations…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit vente historique ─────────────────────────────────────────────────────

function EditVenteHisto({ vente, onClose, onSaved }: { vente: VenteHisto; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date(vente.date).toISOString().slice(0, 10));
  const [typeAnimal, setTypeAnimal] = useState(vente.typeAnimal);
  const [typeVente, setTypeVente] = useState(vente.typeVente);
  const [nutrav, setNutrav] = useState(vente.nutrav ?? "");
  const [sexe, setSexe] = useState(vente.sexe ?? "");
  const [poidsVif, setPoidsVif] = useState(vente.poidsVif?.toString() ?? "");
  const [prixKgVif, setPrixKgVif] = useState(vente.prixKgVif?.toString() ?? "");
  const [poidsCarc, setPoidsCarc] = useState(vente.poidsCarc?.toString() ?? "");
  const [prixKgCarc, setPrixKgCarc] = useState(vente.prixKgCarc?.toString() ?? "");
  const [acheteur, setAcheteur] = useState(vente.acheteur ?? "");
  const [total, setTotal] = useState(vente.total?.toString() ?? "");
  const [notes, setNotes] = useState(vente.notes ?? "");

  const isVif = typeVente === "vif";
  const prixCalc = isVif
    ? (prixKgVif && poidsVif ? (parseFloat(prixKgVif) * parseFloat(poidsVif)).toFixed(2) : null)
    : (prixKgCarc && poidsCarc ? (parseFloat(prixKgCarc) * parseFloat(poidsCarc)).toFixed(2) : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/ventes-historiques/${vente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, typeAnimal, typeVente, nutrav: nutrav || null, sexe: sexe || null,
          poidsVif: poidsVif ? parseFloat(poidsVif) : null,
          prixKgVif: prixKgVif ? parseFloat(prixKgVif) : null,
          poidsCarc: poidsCarc ? parseFloat(poidsCarc) : null,
          prixKgCarc: prixKgCarc ? parseFloat(prixKgCarc) : null,
          acheteur: acheteur || null,
          total: total ? parseFloat(total) : (prixCalc ? parseFloat(prixCalc) : null),
          notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
      onSaved(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  async function supprimer() {
    if (!confirm("Supprimer cette vente ?")) return;
    setLoading(true);
    try {
      await fetch(`/api/ventes-historiques/${vente.id}`, { method: "DELETE" });
      onSaved(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-gray-800 text-sm">Modifier la vente — {vente.nutrav ?? "?"} ({vente.annee})</span>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">N° animal</label>
              <input value={nutrav} onChange={(e) => setNutrav(e.target.value)} placeholder="Ex: 9284"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type animal</label>
              <select value={typeAnimal} onChange={(e) => setTypeAnimal(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="veaux">Veaux</option>
                <option value="vaches">Vaches</option>
                <option value="taureau">Taureau</option>
                <option value="génisse">Génisse</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type vente</label>
              <select value={typeVente} onChange={(e) => setTypeVente(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="vif">Vif</option>
                <option value="carcasse">Carcasse</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sexe</label>
              <select value={sexe} onChange={(e) => setSexe(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">—</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
          </div>
          {isVif ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Poids vif (kg)</label>
                <input type="number" step="0.5" value={poidsVif} onChange={(e) => setPoidsVif(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prix €/kg vif</label>
                <input type="number" step="0.01" value={prixKgVif} onChange={(e) => setPrixKgVif(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Poids carcasse (kg)</label>
                <input type="number" step="0.1" value={poidsCarc} onChange={(e) => setPoidsCarc(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prix €/kg carc.</label>
                <input type="number" step="0.01" value={prixKgCarc} onChange={(e) => setPrixKgCarc(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Acheteur</label>
              <input value={acheteur} onChange={(e) => setAcheteur(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Total HT {prixCalc && !total && <span className="text-green-600 font-normal">≈ {prixCalc} €</span>}
              </label>
              <input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)}
                placeholder={prixCalc ?? ""}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={supprimer} disabled={loading}
              className="px-3 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50">
              Supprimer
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium">Annuler</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, delta, color = "text-gray-800" }: {
  label: string; value: string; sub?: string;
  delta?: { curr: number | null; prev: number | null }; color?: string;
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

// ── Vue Détail (toutes les années, tableau complet) ───────────────────────────

const TYPE_BADGE: Record<string, string> = {
  ELEVAGE: "bg-green-100 text-green-700",
  BOUCHERIE: "bg-orange-100 text-orange-700",
  ENGRAISSEMENT: "bg-blue-100 text-blue-700",
  MORT: "bg-gray-100 text-gray-600",
};
const TYPE_LABEL: Record<string, string> = {
  ELEVAGE: "Vente vif", BOUCHERIE: "Boucherie", ENGRAISSEMENT: "Engraissement", MORT: "Mort",
};

function SortieRow({ s, onEdit }: { s: SortieDetail; onEdit: (s: SortieDetail) => void }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-green-700 text-xs bg-green-50 px-1.5 py-0.5 rounded">
            {s.animal.nutrav}
          </span>
          <span className="text-sm font-medium text-gray-700 truncate max-w-[140px]">
            {s.animal.nobovi ?? "Sans nom"}
          </span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${TYPE_BADGE[s.type] ?? "bg-gray-100 text-gray-600"}`}>
            {TYPE_LABEL[s.type] ?? s.type}
          </span>
          {s.isVeau && <span className="text-[10px] text-gray-400 italic">veau</span>}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
          <span>{fmtDate(s.date)}</span>
          {s.poidsVif && <span>{fmtKg(s.poidsVif)} vif{s.rendementCarcasse ? ` → ${s.rendementCarcasse}%` : ""}</span>}
          {s.poids && <span>{fmtKg(s.poids)}{s.type === "BOUCHERIE" ? " carc." : ""}</span>}
          {s.prixKilo && <span>{s.prixKilo.toFixed(2)} €/kg</span>}
          {(s.prixDefinitifHT ?? s.prixPrevuHT) && (
            <span className="font-semibold text-green-700">
              {fmtEuro(s.prixDefinitifHT ?? s.prixPrevuHT)}
            </span>
          )}
          {s.acheteur && <span className="text-gray-400">→ {s.acheteur}</span>}
        </div>
      </div>
      <button
        onClick={() => onEdit(s)}
        className="shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors mt-0.5"
      >
        <Pencil size={13} />
        <span className="hidden sm:inline">Modifier</span>
      </button>
    </div>
  );
}

function VueDetail({ stats, sortiesParAnnee, ventesHisto, anneeActive }: {
  stats: AnneeStats[];
  sortiesParAnnee: Record<number, SortieDetail[]>;
  ventesHisto: VenteHisto[];
  anneeActive: number;
}) {
  const router = useRouter();
  const annees = stats.map((s) => s.annee).sort((a, b) => b - a);
  const [filtreAnnee, setFiltreAnnee] = useState<number | "all">("all");
  const [filtreType, setFiltreType] = useState<string>("all");
  const [editSortie, setEditSortie] = useState<SortieDetail | null>(null);
  const [editVente, setEditVente] = useState<VenteHisto | null>(null);

  // Sorties réelles
  const toutesLesSorties: (SortieDetail & { anneeNum: number })[] = annees.flatMap((a) =>
    (sortiesParAnnee[a] ?? []).map((s) => ({ ...s, anneeNum: a }))
  );
  const sortiesFiltrees = toutesLesSorties.filter((s) => {
    if (filtreAnnee !== "all" && s.anneeNum !== filtreAnnee) return false;
    if (filtreType !== "all") {
      if (filtreType === "veaux" && !s.isVeau) return false;
      if (filtreType === "vaches" && (s.type !== "BOUCHERIE" || s.isVeau)) return false;
    }
    return true;
  });

  // Ventes historiques
  const ventesFiltrees = ventesHisto.filter((v) => {
    if (filtreAnnee !== "all" && v.annee !== filtreAnnee) return false;
    if (filtreType !== "all") {
      if (filtreType === "veaux" && v.typeAnimal !== "veaux") return false;
      if (filtreType === "vaches" && v.typeAnimal === "veaux") return false;
    }
    return true;
  });

  const anneesAvecData = [...new Set([
    ...sortiesFiltrees.map((s) => s.anneeNum),
    ...ventesFiltrees.map((v) => v.annee),
  ])].sort((a, b) => b - a);

  const caTotal =
    sortiesFiltrees.reduce((sum, s) => sum + (s.prixDefinitifHT ?? s.prixPrevuHT ?? 0), 0) +
    ventesFiltrees.reduce((sum, v) => sum + (v.total ?? 0), 0);
  const nbTotal = sortiesFiltrees.length + ventesFiltrees.length;

  function onSaved() { router.refresh(); }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="bg-white rounded-xl shadow px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFiltreAnnee("all")}
            className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${filtreAnnee === "all" ? "bg-green-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
            Toutes
          </button>
          {annees.map((a) => (
            <button key={a} onClick={() => setFiltreAnnee(a)}
              className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${filtreAnnee === a ? "bg-green-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              {a}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-gray-200 hidden sm:block" />
        <div className="flex gap-1.5 flex-wrap">
          {[{ key: "all", label: "Tous" }, { key: "veaux", label: "Veaux" }, { key: "vaches", label: "Vaches" }].map(({ key, label }) => (
            <button key={key} onClick={() => setFiltreType(key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${filtreType === key ? "bg-gray-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-400">{nbTotal} entrée{nbTotal > 1 ? "s" : ""} · {fmtEuro(caTotal)}</span>
      </div>

      {/* Tableau toutes années */}
      {anneesAvecData.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">Aucune vente</div>
      ) : (
        anneesAvecData.map((annee) => {
          const statAnnee = stats.find((s) => s.annee === annee);
          const sortiesAnnee = sortiesFiltrees.filter((s) => s.anneeNum === annee);
          const ventesAnnee = ventesFiltrees.filter((v) => v.annee === annee);
          const caAnnee =
            sortiesAnnee.reduce((sum, s) => sum + (s.prixDefinitifHT ?? s.prixPrevuHT ?? 0), 0) +
            ventesAnnee.reduce((sum, v) => sum + (v.total ?? 0), 0);
          return (
            <div key={annee} className="bg-white rounded-xl shadow overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-800 text-sm">{annee}</span>
                  {statAnnee && (
                    <span className="text-xs text-gray-500">
                      {statAnnee.veauxCount} veaux · {statAnnee.vachesCount} vaches
                      {statAnnee.tauxProductivite != null && ` · ${statAnnee.tauxProductivite}%`}
                    </span>
                  )}
                  {ventesAnnee.length > 0 && sortiesAnnee.length === 0 && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">historique Excel</span>
                  )}
                </div>
                <span className="text-xs font-semibold text-green-700">{fmtEuro(caAnnee)}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {/* Sorties réelles */}
                {sortiesAnnee.map((s) => (
                  <SortieRow key={s.id} s={s} onEdit={setEditSortie} />
                ))}
                {/* Ventes historiques Excel */}
                {ventesAnnee.map((v) => (
                  <div key={v.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-amber-700 text-xs bg-amber-50 px-1.5 py-0.5 rounded">
                          {v.nutrav ?? "—"}
                        </span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${v.typeAnimal === "veaux" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                          {v.typeAnimal} {v.typeVente}
                        </span>
                        {v.sexe && <span className="text-[10px] text-gray-400">{v.sexe}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span>{fmtDate(v.date)}</span>
                        {v.poidsVif && <span>{fmtKg(v.poidsVif)} vif</span>}
                        {v.poidsCarc && <span>{fmtKg(v.poidsCarc)} carc.</span>}
                        {v.prixKgVif && <span>{v.prixKgVif.toFixed(2)} €/kg vif</span>}
                        {v.prixKgCarc && <span>{v.prixKgCarc.toFixed(2)} €/kg carc.</span>}
                        {v.total && <span className="font-semibold text-green-700">{fmtEuro(v.total)}</span>}
                        {v.acheteur && <span className="text-gray-400">→ {v.acheteur}</span>}
                      </div>
                    </div>
                    <button onClick={() => setEditVente(v)}
                      className="shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors mt-0.5">
                      <Pencil size={13} /><span className="hidden sm:inline">Modifier</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {editSortie && <EditDrawer sortie={editSortie} onClose={() => setEditSortie(null)} onSaved={onSaved} />}
      {editVente && <EditVenteHisto vente={editVente} onClose={() => setEditVente(null)} onSaved={onSaved} />}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StatsClient({ stats, sortiesParAnnee, anneeActive, ventesHisto }: {
  stats: AnneeStats[];
  sortiesParAnnee: Record<number, SortieDetail[]>;
  anneeActive: number;
  ventesHisto: VenteHisto[];
}) {
  const [vue, setVue] = useState<"graphiques" | "detail">("graphiques");
  const anneeMax = new Date().getFullYear();
  const anneesDispos = stats.map((s) => s.annee).sort((a, b) => b - a);
  const [anneeKpi, setAnneeKpi] = useState<number>(
    stats.find((s) => s.annee === anneeMax)?.annee ?? anneesDispos[0] ?? anneeMax
  );
  // Filtres graphiques
  const [filtreAnneesGraph, setFiltreAnneesGraph] = useState<number[]>([]); // vide = toutes
  const [filtreSexe, setFiltreSexe] = useState<"all" | "M" | "F">("all");

  const statsFiltrees = stats.filter((s) =>
    filtreAnneesGraph.length === 0 || filtreAnneesGraph.includes(s.annee)
  ).map((s) => {
    if (filtreSexe === "all") return s;
    // Pour les veaux : filtrer par sexe (M ou F)
    const ratio = s.veauxCount > 0
      ? (filtreSexe === "M" ? s.veauxMCount / s.veauxCount : s.veauxFCount / s.veauxCount)
      : 0;
    return {
      ...s,
      veauxCount: filtreSexe === "M" ? s.veauxMCount : s.veauxFCount,
      veauxKgTotal: Math.round(s.veauxKgTotal * ratio),
      veauxCA: Math.round(s.veauxCA * ratio),
    };
  });

  const curr = statsFiltrees.find((s) => s.annee === anneeKpi) ?? statsFiltrees[statsFiltrees.length - 1];
  const prev = statsFiltrees.find((s) => s.annee === (curr?.annee ?? 0) - 1);
  const labels = statsFiltrees.map((s) => String(s.annee));

  function toggleAnneeGraph(a: number) {
    setFiltreAnneesGraph((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  return (
    <div className="space-y-4">
      {/* Bandeau import historique si moins de 3 années */}
      {stats.length < 3 && (
        <BoutonSeedHistorique onDone={() => {}} />
      )}

      {/* Onglets + IA */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex bg-white rounded-xl shadow p-1 gap-1">
          <button onClick={() => setVue("graphiques")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${vue === "graphiques" ? "bg-green-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
            <BarChart2 size={15} />Graphiques
          </button>
          <button onClick={() => setVue("detail")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${vue === "detail" ? "bg-green-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
            <List size={15} />Détail / Modifier
          </button>
        </div>
        <AnalyseIA stats={stats} />
      </div>

      {vue === "graphiques" && (
        <div className="space-y-5">
          {/* Filtres graphiques */}
          <div className="bg-white rounded-xl shadow px-4 py-3 flex flex-wrap gap-3 items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Années</span>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setFiltreAnneesGraph([])}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${filtreAnneesGraph.length === 0 ? "bg-green-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                  Toutes
                </button>
                {anneesDispos.slice().reverse().map((a) => (
                  <button key={a} onClick={() => toggleAnneeGraph(a)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${filtreAnneesGraph.includes(a) ? "bg-green-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-8 w-px bg-gray-200 hidden sm:block" />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Sexe veaux</span>
              <div className="flex gap-1.5">
                {([["all","Tous"],["M","Mâles ♂"],["F","Femelles ♀"]] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setFiltreSexe(key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${filtreSexe === key ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sélecteur d'année + KPIs */}
          {curr && (
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Résumé —</span>
                <div className="flex gap-1.5 flex-wrap">
                  {statsFiltrees.map((s) => s.annee).map((a) => (
                    <button key={a} onClick={() => setAnneeKpi(a)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${a === anneeKpi ? "bg-green-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard label="CA total" value={fmtEuro(curr.caTotal)} delta={{ curr: curr.caTotal, prev: prev?.caTotal ?? null }} color="text-green-700" />
                <KpiCard label="Veaux vendus" value={String(curr.veauxCount)} sub={fmtKg(curr.veauxKgTotal) + " vif"} delta={{ curr: curr.veauxCount, prev: prev?.veauxCount ?? null }} />
                <KpiCard label="Prix moy. veaux" value={fmtPrix(curr.veauxPrixMoyen)} delta={{ curr: curr.veauxPrixMoyen, prev: prev?.veauxPrixMoyen ?? null }} />
                <KpiCard label="Productivité" value={curr.tauxProductivite != null ? `${curr.tauxProductivite}%` : "—"} sub="veaux / vêlages"
                  color={curr.tauxProductivite != null ? curr.tauxProductivite >= 80 ? "text-green-600" : curr.tauxProductivite >= 60 ? "text-yellow-600" : "text-red-500" : "text-gray-400"} />
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="font-semibold text-gray-800 mb-1">Chiffre d&apos;affaires par année</h3>
            <p className="text-xs text-gray-400 mb-3">Veaux vif + Vaches boucherie</p>
            <StackedBarChart data={statsFiltrees.map((s) => ({ veaux: s.veauxCA, vaches: s.vachesCA }))} labels={labels} keys={["veaux","vaches"]} colors={["#22c55e","#f97316"]} keyLabels={["Veaux vif","Vaches boucherie"]} />
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="font-semibold text-gray-800 mb-1">Évolution du prix moyen au kilo</h3>
            <p className="text-xs text-gray-400 mb-3">Veaux (€/kg vif) et vaches (€/kg carcasse) — année par année</p>
            <LineChart series={[{ name:"Veaux €/kg vif", values: statsFiltrees.map((s) => s.veauxPrixMoyen) }, { name:"Vaches €/kg carc.", values: statsFiltrees.map((s) => s.vachesPrixMoyen) }]} labels={labels} colors={["#22c55e","#f97316"]} unit=" €" height={130} />
            <div className="flex gap-4 mt-1 text-xs text-gray-500 justify-end">
              <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded inline-block bg-green-500" />Veaux vif</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded inline-block bg-orange-500" />Vaches carc.</span>
            </div>
          </div>

          {/* Variation du prix dans l'année (par mois, sorties réelles seulement) */}
          <PrixMensuelChart sortiesParAnnee={sortiesParAnnee} anneeSelectionnee={anneeKpi} />

          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="font-semibold text-gray-800 mb-1">Volumes — nombre d&apos;animaux</h3>
            <p className="text-xs text-gray-400 mb-3">Évolution du nombre de têtes vendues</p>
            <LineChart
              series={[
                { name: filtreSexe === "M" ? "Veaux mâles" : filtreSexe === "F" ? "Veaux femelles" : "Veaux", values: statsFiltrees.map((s) => filtreSexe === "M" ? s.veauxMCount : filtreSexe === "F" ? s.veauxFCount : s.veauxCount) },
                { name:"Vaches boucherie", values: statsFiltrees.map((s) => s.vachesCount) },
              ]}
              labels={labels} colors={["#3b82f6","#f59e0b"]} height={110}
            />
            <div className="flex gap-4 mt-1 text-xs text-gray-500 justify-end">
              <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded inline-block bg-blue-500" />Veaux</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded inline-block bg-amber-500" />Vaches carc.</span>
            </div>
          </div>

          {statsFiltrees.some((s) => s.tauxProductivite != null) && (
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-1">Taux de productivité</h3>
              <p className="text-xs text-gray-400 mb-3">Veaux vendus / vêlages — objectif ≥ 80%</p>
              <LineChart series={[{ name:"Productivité", values: statsFiltrees.map((s) => s.tauxProductivite) }]} labels={labels} colors={["#8b5cf6"]} unit="%" height={110} />
            </div>
          )}

          {/* Tableau synthèse */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <h3 className="font-semibold text-gray-800 px-4 pt-4 pb-2">Tableau comparatif</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Indicateur</th>
                    {statsFiltrees.map((s) => (
                      <th key={s.annee} className={`px-3 py-2 text-center font-semibold ${s.annee === anneeMax ? "bg-green-50 text-green-700" : "text-gray-600"}`}>
                        {s.annee}{s.annee === anneeMax && <span className="block text-[10px] font-normal text-green-400">en cours</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { label:"🐄 Veaux vendus", fn:(s:AnneeStats)=>s.veauxCount||"—", numFn:(s:AnneeStats)=>s.veauxCount },
                    { label:"Kg total vif", fn:(s:AnneeStats)=>fmtKg(s.veauxKgTotal), numFn:(s:AnneeStats)=>s.veauxKgTotal },
                    { label:"Prix moy. €/kg vif", fn:(s:AnneeStats)=>fmtPrix(s.veauxPrixMoyen), numFn:(s:AnneeStats)=>s.veauxPrixMoyen },
                    { label:"CA veaux", fn:(s:AnneeStats)=>fmtEuro(s.veauxCA), numFn:(s:AnneeStats)=>s.veauxCA },
                    { label:"🥩 Vaches boucherie", fn:(s:AnneeStats)=>s.vachesCount||"—", numFn:(s:AnneeStats)=>s.vachesCount },
                    { label:"Kg carcasse", fn:(s:AnneeStats)=>fmtKg(s.vachesKgCarcasse), numFn:(s:AnneeStats)=>s.vachesKgCarcasse },
                    { label:"Prix moy. €/kg carc.", fn:(s:AnneeStats)=>fmtPrix(s.vachesPrixMoyen), numFn:(s:AnneeStats)=>s.vachesPrixMoyen },
                    { label:"CA vaches", fn:(s:AnneeStats)=>fmtEuro(s.vachesCA), numFn:(s:AnneeStats)=>s.vachesCA },
                    { label:"📊 CA total", fn:(s:AnneeStats)=>fmtEuro(s.caTotal), numFn:(s:AnneeStats)=>s.caTotal, bold:true },
                    { label:"Productivité %", fn:(s:AnneeStats)=>s.tauxProductivite!=null?`${s.tauxProductivite}%`:"—", numFn:(s:AnneeStats)=>s.tauxProductivite },
                  ].map((row) => (
                    <tr key={row.label} className="hover:bg-gray-50">
                      <td className={`px-3 py-2 text-gray-600 ${row.bold?"font-bold":""}`}>{row.label}</td>
                      {statsFiltrees.map((s, si) => {
                        const prevS = statsFiltrees[si - 1];
                        return (
                          <td key={s.annee} className={`px-3 py-2 text-center ${s.annee===anneeMax?"bg-green-50/40":""}`}>
                            <span className={`block ${row.bold?"font-bold text-green-700":"text-gray-800"}`}>{String(row.fn(s))}</span>
                            {si > 0 && <Delta curr={row.numFn(s)} prev={row.numFn(prevS)} />}
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
      )}

      {vue === "detail" && (
        <VueDetail stats={stats} sortiesParAnnee={sortiesParAnnee} ventesHisto={ventesHisto} anneeActive={anneeActive} />
      )}
    </div>
  );
}

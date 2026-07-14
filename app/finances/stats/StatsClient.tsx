"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Minus, Sparkles, X, Loader2, Pencil, BarChart2, List, Baby } from "lucide-react";
import type { AnneeStats, SortieDetail, VenteHisto, GestationRecord } from "./page";
import GestationStats from "./GestationStats";
import SortieEditorModal, { SortieEditorValues } from "../SortieEditorModal";

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
  async function enregistrer(values: SortieEditorValues) {
    const res = await fetch(`/api/sorties/${sortie.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, poidsVif: null, rendementCarcasse: null }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
    onSaved();
    onClose();
  }

  return (
    <SortieEditorModal
      title="Modifier la sortie"
      animalLabel={`${sortie.animal.nutrav} — ${sortie.animal.nobovi ?? "Sans nom"}`}
      initial={{
        date: new Date(sortie.date).toISOString().slice(0, 10),
        type: sortie.type,
        acheteur: sortie.acheteur,
        poids: sortie.poids,
        prixKilo: sortie.prixKilo,
        prixDefinitifHT: sortie.prixDefinitifHT,
        notes: sortie.notes,
        causeMortalite: sortie.causeMortalite,
      }}
      onClose={onClose}
      onSubmit={enregistrer}
    />
  );
}

// ── Edit vente historique ─────────────────────────────────────────────────────

function EditVenteHisto({ vente, onClose, onSaved }: { vente: VenteHisto; onClose: () => void; onSaved: () => void }) {
  const isCarcasse = vente.typeVente === "carcasse";
  const poidsInitial = isCarcasse ? vente.poidsCarc : vente.poidsVif;
  const prixInitial = isCarcasse ? vente.prixKgCarc : vente.prixKgVif;
  const totalEstCalcule = poidsInitial != null && prixInitial != null;

  async function enregistrer(values: SortieEditorValues) {
    const venteVif = values.type === "ELEVAGE";
    const montantCalcule = values.poids != null && values.prixKilo != null
      ? Math.round(values.poids * values.prixKilo * 100) / 100
      : null;
    const res = await fetch(`/api/ventes-historiques/${vente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: values.date,
        typeAnimal: vente.typeAnimal,
        typeVente: values.type === "MORT" ? "mort" : (venteVif ? "vif" : "carcasse"),
        nutrav: vente.nutrav,
        sexe: vente.sexe,
        poidsVif: venteVif ? values.poids : null,
        prixKgVif: venteVif ? values.prixKilo : null,
        poidsCarc: values.type === "BOUCHERIE" ? values.poids : null,
        prixKgCarc: values.type === "BOUCHERIE" ? values.prixKilo : null,
        acheteur: values.acheteur,
        total: values.type === "MORT" ? null : (values.prixDefinitifHT ?? montantCalcule),
        notes: values.notes,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
    onSaved();
    onClose();
  }

  async function supprimer() {
    const res = await fetch(`/api/ventes-historiques/${vente.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("La suppression a échoué");
    onSaved();
    onClose();
  }

  return (
    <SortieEditorModal
      title="Modifier la sortie"
      animalLabel={`${vente.nutrav ?? "Numéro inconnu"} — ${vente.animalNom ?? "Sans nom"}`}
      initial={{
        date: new Date(vente.date).toISOString().slice(0, 10),
        type: vente.typeVente === "mort" ? "MORT" : (isCarcasse ? "BOUCHERIE" : "ELEVAGE"),
        acheteur: vente.acheteur,
        poids: poidsInitial,
        prixKilo: prixInitial,
        prixDefinitifHT: totalEstCalcule ? null : vente.total,
        notes: vente.notes,
      }}
      onClose={onClose}
      onSubmit={enregistrer}
      onDelete={supprimer}
    />
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

export default function StatsClient({ stats, sortiesParAnnee, anneeActive, ventesHisto, gestationRecords }: {
  stats: AnneeStats[];
  sortiesParAnnee: Record<number, SortieDetail[]>;
  anneeActive: number;
  ventesHisto: VenteHisto[];
  gestationRecords: GestationRecord[];
}) {
  const [vue, setVue] = useState<"graphiques" | "detail" | "gestation">("graphiques");
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
      {/* Bandeau import — toujours visible pour permettre la mise à jour */}
      <BoutonSeedHistorique onDone={() => {}} />

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
          <button onClick={() => setVue("gestation")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${vue === "gestation" ? "bg-green-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
            <Baby size={15} />Gestation
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

      {vue === "gestation" && (
        <GestationStats records={gestationRecords} />
      )}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Search, X, Expand, Minimize2, RefreshCw } from "lucide-react";
import type { AnimalGeneaNode } from "./page";

/* ─── Bouton import généalogie PDF ──────────────────── */
function BoutonImportGenea() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { mere: { ok: number; ko: number }; pere: { ok: number }; veauxNonTrouves: number }>(null);

  async function run() {
    setLoading(true);
    try {
      const r = await fetch("/api/genealogie-import", { method: "POST" });
      const data = await r.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-800">Lier généalogie depuis PDFs (ZEUS / MICKEY / ULYSSE)</p>
          <p className="text-xs text-amber-600 mt-0.5">Met à jour les liens mère→veau et père (172 entrées)</p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "En cours…" : "Importer"}
        </button>
      </div>
      {result && (
        <div className="text-xs text-amber-800 bg-amber-100 rounded-lg p-2 space-y-0.5">
          <p>✓ Mères liées : <strong>{result.mere.ok}</strong> · Non trouvées : {result.mere.ko}</p>
          <p>✓ Pères mis à jour : <strong>{result.pere.ok}</strong></p>
          {result.veauxNonTrouves > 0 && <p className="text-amber-600">⚠ Veaux non trouvés en DB : {result.veauxNonTrouves}</p>}
          <p className="text-amber-600 font-medium mt-1">Rafraîchis la page pour voir les changements dans l&apos;arbre.</p>
        </div>
      )}
    </div>
  );
}

/* ─── Couleurs ──────────────────────────────────────── */
function nodeStyle(node: AnimalGeneaNode) {
  if (node.statut === "SORTI") return { dot: "bg-gray-300", badge: "bg-gray-100 text-gray-400 border-gray-200", line: "#e5e7eb" };
  if (node.sexe === "M") return { dot: "bg-sky-400",     badge: "bg-sky-50 text-sky-700 border-sky-200",     line: "#7dd3fc" };
  const cat = node.categorie ?? "";
  if (cat.includes("GENISSE") || cat === "VELLE") return { dot: "bg-violet-400", badge: "bg-violet-50 text-violet-700 border-violet-200", line: "#c4b5fd" };
  return { dot: "bg-emerald-500",  badge: "bg-emerald-50 text-emerald-700 border-emerald-200", line: "#6ee7b7" };
}

function ageFmt(danais: string | null) {
  if (!danais) return null;
  const days = Math.floor((Date.now() - new Date(danais).getTime()) / 86400000);
  if (days < 30)  return `${days}j`;
  if (days < 365) return `${Math.floor(days / 30)}mois`;
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return m > 0 ? `${y}a ${m}m` : `${y}a`;
}

/* ─── Nœud individuel ───────────────────────────────── */
function GeneaNode({
  node,
  depth,
  isLast,
  forceOpen,
  highlight,
}: {
  node: AnimalGeneaNode;
  depth: number;
  isLast: boolean;
  forceOpen: boolean | null; // null = user-controlled
  highlight: string;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isOpen = forceOpen !== null ? forceOpen : open;

  const hasChildren = node.children.length > 0;
  const style = nodeStyle(node);

  const matchesSearch =
    highlight.length > 1 &&
    (node.nutrav.toLowerCase().includes(highlight) ||
      (node.nobovi ?? "").toLowerCase().includes(highlight));

  return (
    <div className="relative">
      {/* Ligne verticale du parent (sauf root) */}
      {depth > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 w-px"
          style={{ background: style.line, opacity: 0.4 }}
        />
      )}

      {/* La ligne de ce nœud */}
      <div className="relative flex items-center group" style={{ paddingLeft: depth === 0 ? 0 : 24 }}>
        {/* Connecteur horizontal */}
        {depth > 0 && (
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-px w-5"
            style={{ background: style.line, opacity: 0.5 }}
          />
        )}

        {/* Toggle ou espace */}
        <button
          onClick={() => { if (hasChildren) setOpen((o) => !o); }}
          className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors
            ${hasChildren ? "cursor-pointer hover:bg-gray-100" : "cursor-default"}`}
          aria-label={isOpen ? "Replier" : "Déplier"}
        >
          {hasChildren ? (
            isOpen
              ? <ChevronDown size={14} className="text-gray-400" />
              : <ChevronRight size={14} className="text-gray-400" />
          ) : (
            <span className="w-2 h-2 rounded-full" style={{ background: style.line }} />
          )}
        </button>

        {/* Contenu du nœud */}
        <Link
          href={`/troupeau/${node.nutrav}`}
          className={`
            ml-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm
            transition-all hover:shadow-md hover:scale-[1.02] active:scale-100
            ${style.badge}
            ${matchesSearch ? "ring-2 ring-yellow-400 ring-offset-1 shadow-yellow-100 shadow-md" : ""}
          `}
        >
          {/* Dot coloré */}
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />

          {/* Nutrav */}
          <span className="font-mono font-bold text-xs">{node.nutrav}</span>

          {/* Nom */}
          {node.nobovi && (
            <span className="text-xs opacity-80 max-w-[120px] truncate">{node.nobovi}</span>
          )}

          {/* Âge */}
          {ageFmt(node.danais) && (
            <span className="text-[10px] opacity-60 ml-1">{ageFmt(node.danais)}</span>
          )}

          {/* Père */}
          {node.pereNom && (
            <span className="text-[10px] opacity-50 hidden sm:inline">× {node.pereNom}</span>
          )}

          {/* Nb enfants */}
          {hasChildren && (
            <span className="ml-1 text-[10px] font-semibold bg-white/50 px-1.5 py-0.5 rounded-full">
              {node.children.length}
            </span>
          )}

          {/* Sorti */}
          {node.statut === "SORTI" && (
            <span className="text-[9px] opacity-50 line-through hidden sm:inline">sorti</span>
          )}
        </Link>
      </div>

      {/* Enfants */}
      {hasChildren && isOpen && (
        <div className="relative pl-6 mt-0.5 space-y-0.5">
          {/* Ligne verticale de connexion */}
          <div
            className="absolute left-[10px] top-0 bottom-4 w-px opacity-30"
            style={{ background: style.dot.replace("bg-", "") }}
          />
          {node.children.map((child, i) => (
            <GeneaNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isLast={i === node.children.length - 1}
              forceOpen={forceOpen}
              highlight={highlight}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Vue globale ───────────────────────────────────── */
export default function GeneaClient({ roots }: { roots: AnimalGeneaNode[] }) {
  const [search, setSearch] = useState("");
  const [forceOpen, setForceOpen] = useState<boolean | null>(null);

  const highlight = search.trim().toLowerCase();

  // Filtrer les racines qui matchent la recherche (ou ont des descendants qui matchent)
  function nodeMatchesSearch(node: AnimalGeneaNode, q: string): boolean {
    if (
      node.nutrav.toLowerCase().includes(q) ||
      (node.nobovi ?? "").toLowerCase().includes(q)
    ) return true;
    return node.children.some((c) => nodeMatchesSearch(c, q));
  }

  const filteredRoots = useMemo(() => {
    if (!highlight || highlight.length < 2) return roots;
    function matchSearch(node: AnimalGeneaNode, q: string): boolean {
      if (node.nutrav.toLowerCase().includes(q) || (node.nobovi ?? "").toLowerCase().includes(q)) return true;
      return node.children.some((c) => matchSearch(c, q));
    }
    return roots.filter((r) => matchSearch(r, highlight));
  }, [roots, highlight]);

  // Stats
  const stats = useMemo(() => {
    function count(nodes: AnimalGeneaNode[]) {
      let actifs = 0, sortis = 0, males = 0, femelles = 0;
      for (const n of nodes) {
        if (n.statut === "ACTIF") actifs++; else sortis++;
        if (n.sexe === "M") males++; else femelles++;
        const sub = count(n.children);
        actifs += sub.actifs; sortis += sub.sortis; males += sub.males; femelles += sub.femelles;
      }
      return { actifs, sortis, males, femelles };
    }
    return count(roots);
  }, [roots]);

  return (
    <div className="space-y-4">
      {/* Import généalogie PDF */}
      <BoutonImportGenea />

      {/* Stats globales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Actifs",    val: stats.actifs,    color: "text-emerald-700" },
          { label: "Sortis",    val: stats.sortis,    color: "text-gray-400" },
          { label: "Mâles",     val: stats.males,     color: "text-sky-700" },
          { label: "Femelles",  val: stats.femelles,  color: "text-pink-600" },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white rounded-xl shadow p-3 text-center">
            <div className={`text-xl font-bold ${color}`}>{val}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un animal…"
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tout déplier / replier */}
        <button
          onClick={() => setForceOpen((v) => (v === true ? null : true))}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border shadow-sm transition-colors
            ${forceOpen === true ? "bg-emerald-600 text-white border-emerald-700" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
        >
          <Expand size={13} />
          Tout déplier
        </button>
        <button
          onClick={() => setForceOpen((v) => (v === false ? null : false))}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border shadow-sm transition-colors
            ${forceOpen === false ? "bg-gray-700 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
        >
          <Minimize2 size={13} />
          Tout replier
        </button>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 px-1">
        {[
          { dot: "bg-emerald-500", label: "Vache active" },
          { dot: "bg-sky-400",     label: "Mâle" },
          { dot: "bg-violet-400",  label: "Génisse / Velle" },
          { dot: "bg-gray-300",    label: "Sorti" },
        ].map(({ dot, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
            {label}
          </span>
        ))}
        <span className="text-gray-400">· × père indique le père du veau</span>
      </div>

      {/* Arbre */}
      <div className="bg-white rounded-2xl shadow-lg p-4 space-y-1 overflow-x-auto">
        {filteredRoots.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">Aucun animal trouvé pour « {search} »</p>
        )}
        {filteredRoots.map((root, i) => (
          <GeneaNode
            key={root.id}
            node={root}
            depth={0}
            isLast={i === filteredRoots.length - 1}
            forceOpen={forceOpen}
            highlight={highlight}
          />
        ))}
      </div>

      <p className="text-center text-xs text-gray-400">
        Les animaux sans mère connue dans la base sont affichés à la racine de l&apos;arbre.
      </p>
    </div>
  );
}

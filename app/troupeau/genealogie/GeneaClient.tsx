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
  defaultOpen,
  highlight,
}: {
  node: AnimalGeneaNode;
  depth: number;
  isLast: boolean;
  defaultOpen: boolean;
  highlight: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
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
          aria-label={open ? "Replier" : "Déplier"}
        >
          {hasChildren ? (
            open
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
      {hasChildren && open && (
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
              defaultOpen={defaultOpen}
              highlight={highlight}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Vue paysage (arbre horizontal SVG) ───────────── */
const NODE_W = 130, NODE_H = 44, H_GAP = 60, V_GAP = 10;

function layoutTree(roots: AnimalGeneaNode[]) {
  // Calcul de la hauteur de chaque sous-arbre
  function treeHeight(n: AnimalGeneaNode): number {
    if (n.children.length === 0) return 1;
    return n.children.reduce((s, c) => s + treeHeight(c), 0);
  }

  interface Placed { node: AnimalGeneaNode; x: number; y: number }
  const placed: Placed[] = [];
  let maxX = 0;

  function place(n: AnimalGeneaNode, col: number, rowStart: number) {
    const h = treeHeight(n);
    const rowCenter = rowStart + h / 2 - 0.5;
    const x = col * (NODE_W + H_GAP);
    const y = rowCenter * (NODE_H + V_GAP);
    placed.push({ node: n, x, y });
    if (x > maxX) maxX = x;
    let cur = rowStart;
    for (const child of n.children) {
      place(child, col + 1, cur);
      cur += treeHeight(child);
    }
  }

  let cur = 0;
  for (const root of roots) {
    place(root, 0, cur);
    cur += treeHeight(root);
  }
  const totalRows = cur;
  const totalH = totalRows * (NODE_H + V_GAP);
  const totalW = maxX + NODE_W;
  return { placed, totalW, totalH };
}

function PaysageNode({ node, x, y, highlight }: { node: AnimalGeneaNode; x: number; y: number; highlight: string }) {
  const style = nodeStyle(node);
  const matched = highlight.length > 1 &&
    (node.nutrav.toLowerCase().includes(highlight) || (node.nobovi ?? "").toLowerCase().includes(highlight));

  // Couleurs SVG depuis Tailwind classes → valeurs hex
  const bgColor =
    node.statut === "SORTI" ? "#f3f4f6" :
    node.sexe === "M" ? "#f0f9ff" :
    (node.categorie ?? "").includes("GENISSE") || node.categorie === "VELLE" ? "#f5f3ff" :
    "#ecfdf5";
  const borderColor =
    node.statut === "SORTI" ? "#d1d5db" :
    node.sexe === "M" ? "#bae6fd" :
    (node.categorie ?? "").includes("GENISSE") || node.categorie === "VELLE" ? "#ddd6fe" :
    "#a7f3d0";
  const textColor =
    node.statut === "SORTI" ? "#9ca3af" :
    node.sexe === "M" ? "#0369a1" :
    (node.categorie ?? "").includes("GENISSE") || node.categorie === "VELLE" ? "#6d28d9" :
    "#065f46";

  return (
    <a href={`/troupeau/${node.nutrav}`}>
      <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={8}
        fill={matched ? "#fef9c3" : bgColor}
        stroke={matched ? "#facc15" : borderColor}
        strokeWidth={matched ? 2 : 1}
      />
      <text x={x + 8} y={y + 16} fontSize={10} fontFamily="monospace" fontWeight="bold" fill={textColor}>
        {node.nutrav}
      </text>
      <text x={x + 8} y={y + 30} fontSize={9} fill={textColor} opacity={0.8}>
        {(node.nobovi ?? "").slice(0, 16)}
        {node.pereNom ? ` × ${node.pereNom.slice(0, 8)}` : ""}
      </text>
    </a>
  );
}

function VuePaysage({ roots, highlight }: { roots: AnimalGeneaNode[]; highlight: string }) {
  const MAX_ROOTS = 30; // limiter pour éviter un SVG trop lourd
  const limited = roots.slice(0, MAX_ROOTS);
  const { placed, totalW, totalH } = useMemo(() => layoutTree(limited), [limited]);

  // Construire les connexions (parent → enfants)
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const posById = new Map(placed.map((p) => [p.node.id, p]));
  for (const { node, x, y } of placed) {
    for (const child of node.children) {
      const cp = posById.get(child.id);
      if (!cp) continue;
      lines.push({
        x1: x + NODE_W,
        y1: y + NODE_H / 2,
        x2: cp.x,
        y2: cp.y + NODE_H / 2,
      });
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-auto">
      {roots.length > MAX_ROOTS && (
        <p className="text-xs text-amber-600 px-4 pt-3">
          Affichage limité aux {MAX_ROOTS} premières racines pour la lisibilité.
        </p>
      )}
      <svg
        width={totalW + 20}
        height={totalH + 20}
        style={{ display: "block", minWidth: totalW + 20 }}
        viewBox={`-10 -10 ${totalW + 20} ${totalH + 20}`}
      >
        {/* Connexions courbes */}
        {lines.map((l, i) => {
          const cx = (l.x1 + l.x2) / 2;
          return (
            <path key={i}
              d={`M${l.x1},${l.y1} C${cx},${l.y1} ${cx},${l.y2} ${l.x2},${l.y2}`}
              fill="none" stroke="#d1d5db" strokeWidth={1.5} strokeLinecap="round"
            />
          );
        })}
        {/* Nœuds */}
        {placed.map(({ node, x, y }) => (
          <PaysageNode key={node.id} node={node} x={x} y={y} highlight={highlight} />
        ))}
      </svg>
    </div>
  );
}

/* ─── Vue par mère ──────────────────────────────────── */
function VueParMere({ roots }: { roots: AnimalGeneaNode[] }) {
  // Collecter toutes les vaches qui ont des descendants directs
  const groupes = useMemo(() => {
    const map = new Map<string, { mere: AnimalGeneaNode; veaux: AnimalGeneaNode[] }>();
    function collect(node: AnimalGeneaNode) {
      if (node.children.length > 0) {
        map.set(node.id, { mere: node, veaux: node.children });
      }
      node.children.forEach(collect);
    }
    roots.forEach(collect);
    return [...map.values()].sort((a, b) => b.veaux.length - a.veaux.length);
  }, [roots]);

  const [openMere, setOpenMere] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {groupes.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-8">Aucune relation mère-veau enregistrée.</p>
      )}
      {groupes.map(({ mere, veaux }) => (
        <div key={mere.id} className="border-b border-gray-100 last:border-0">
          <button
            onClick={() => setOpenMere(openMere === mere.id ? null : mere.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
          >
            {openMere === mere.id
              ? <ChevronDown size={15} className="text-emerald-500 flex-shrink-0" />
              : <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />}
            <Link href={`/troupeau/${mere.nutrav}`} onClick={(e) => e.stopPropagation()}
              className="font-mono font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded hover:underline">
              {mere.nutrav}
            </Link>
            {mere.nobovi && <span className="text-sm text-gray-700">{mere.nobovi}</span>}
            {ageFmt(mere.danais) && <span className="text-xs text-gray-400">{ageFmt(mere.danais)}</span>}
            {mere.statut === "SORTI" && <span className="text-[10px] text-gray-400 line-through">sortie</span>}
            <span className="ml-auto text-xs bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full">
              {veaux.length} veau{veaux.length > 1 ? "x" : ""}
            </span>
          </button>
          {openMere === mere.id && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {veaux.map((v) => (
                <Link key={v.id} href={`/troupeau/${v.nutrav}`}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium hover:shadow transition-all
                    ${v.sexe === "M" ? "bg-sky-50 border-sky-200 text-sky-700" : "bg-pink-50 border-pink-200 text-pink-700"}
                    ${v.statut === "SORTI" ? "opacity-40" : ""}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${v.sexe === "M" ? "bg-sky-400" : "bg-pink-400"}`} />
                  <span className="font-mono">{v.nutrav}</span>
                  {v.nobovi && <span className="opacity-70">{v.nobovi}</span>}
                  {v.pereNom && <span className="text-[10px] opacity-50">× {v.pereNom}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Vue consanguinité ─────────────────────────────── */
// Risque = un animal dont le père apparaît aussi dans la lignée maternelle (grand-père, arrière-grand-père)
function VueConsanguinite({ roots }: { roots: AnimalGeneaNode[] }) {
  const alertes = useMemo(() => {
    const byId = new Map<string, AnimalGeneaNode>();
    function index(n: AnimalGeneaNode) { byId.set(n.id, n); n.children.forEach(index); }
    roots.forEach(index);

    // Remonte la lignée maternelle et collecte tous les pères trouvés
    function peresDansLigneeMere(nodeId: string | null, depth = 0): Set<string> {
      if (!nodeId || depth > 5) return new Set();
      const node = byId.get(nodeId);
      if (!node) return new Set();
      const peres = new Set<string>();
      if (node.pereNat) peres.add(node.pereNat);
      if (node.pereNom) peres.add(node.pereNom);
      // Remonter la mère
      const fromMere = peresDansLigneeMere(node.mereId, depth + 1);
      fromMere.forEach((p) => peres.add(p));
      return peres;
    }

    const risques: { animal: AnimalGeneaNode; pereCommun: string; niveau: "elevé" | "modéré" }[] = [];

    function check(node: AnimalGeneaNode) {
      if (node.pereNat || node.pereNom) {
        const pereLigne = peresDansLigneeMere(node.mereId);
        const pereKey = node.pereNat ?? node.pereNom ?? "";
        const pereNomKey = node.pereNom ?? "";
        if (pereLigne.has(pereKey) || pereLigne.has(pereNomKey)) {
          // Vérifier le niveau : si c'est le père direct de la mère → élevé
          const mere = node.mereId ? byId.get(node.mereId) : null;
          const grandPereNat = mere?.pereNat ?? mere?.pereNom ?? "";
          const niveau = (pereKey && pereKey === grandPereNat) || (pereNomKey && pereNomKey === grandPereNat)
            ? "elevé" : "modéré";
          risques.push({ animal: node, pereCommun: node.pereNom ?? node.pereNat ?? "?", niveau });
        }
      }
      node.children.forEach(check);
    }
    roots.forEach(check);
    return risques.sort((a, b) => (a.niveau === "elevé" ? -1 : 1) - (b.niveau === "elevé" ? -1 : 1));
  }, [roots]);

  if (alertes.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-gray-700 font-semibold">Aucun risque de consanguinité détecté</p>
        <p className="text-xs text-gray-400 mt-2">Vérification sur les 5 générations disponibles en base</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-red-800">
          ⚠ {alertes.length} animal{alertes.length > 1 ? "x" : ""} avec risque de consanguinité détecté{alertes.length > 1 ? "s" : ""}
        </p>
        <p className="text-xs text-red-600 mt-1">
          Le père utilisé apparaît déjà dans la lignée maternelle — risque de dépression de consanguinité (réduction des performances, défauts génétiques).
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {alertes.map(({ animal, pereCommun, niveau }) => (
          <div key={animal.id}
            className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0
              ${niveau === "elevé" ? "bg-red-50/60" : "bg-orange-50/40"}`}
          >
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${niveau === "elevé" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
              {niveau === "elevé" ? "🔴 Élevé" : "🟠 Modéré"}
            </span>
            <Link href={`/troupeau/${animal.nutrav}`}
              className="font-mono font-bold text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded hover:underline">
              {animal.nutrav}
            </Link>
            {animal.nobovi && <span className="text-sm text-gray-700">{animal.nobovi}</span>}
            <span className="ml-auto text-xs text-gray-500">
              père <strong>{pereCommun}</strong> déjà dans la lignée maternelle
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Conseil : alterner les taureaux entre générations et éviter de saillir avec un taureau déjà grand-père maternel.
      </p>
    </div>
  );
}

/* ─── Vue par père ──────────────────────────────────── */
function VueParPere({ roots }: { roots: AnimalGeneaNode[] }) {
  const groupes = useMemo(() => {
    const map = new Map<string, AnimalGeneaNode[]>();
    function collect(node: AnimalGeneaNode) {
      const pere = node.pereNom ?? "Père inconnu";
      const list = map.get(pere) ?? [];
      list.push(node);
      map.set(pere, list);
      node.children.forEach(collect);
    }
    roots.forEach(collect);
    return [...map.entries()]
      .map(([pere, veaux]) => ({ pere, veaux, nb: veaux.length }))
      .sort((a, b) => b.nb - a.nb);
  }, [roots]);

  const [openPere, setOpenPere] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {groupes.map(({ pere, veaux, nb }) => (
        <div key={pere} className="border-b border-gray-100 last:border-0">
          <button
            onClick={() => setOpenPere(openPere === pere ? null : pere)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
          >
            {openPere === pere
              ? <ChevronDown size={15} className="text-blue-500 flex-shrink-0" />
              : <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />}
            <span className="font-semibold text-blue-700 text-sm">{pere}</span>
            <span className="ml-auto text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">
              {nb} descendant{nb > 1 ? "s" : ""}
            </span>
          </button>
          {openPere === pere && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {veaux.map((v) => (
                <Link
                  key={v.id}
                  href={`/troupeau/${v.nutrav}`}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium hover:shadow transition-all
                    ${v.sexe === "M" ? "bg-sky-50 border-sky-200 text-sky-700" : "bg-pink-50 border-pink-200 text-pink-700"}
                    ${v.statut === "SORTI" ? "opacity-40 line-through" : ""}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${v.sexe === "M" ? "bg-sky-400" : "bg-pink-400"}`} />
                  <span className="font-mono">{v.nutrav}</span>
                  {v.nobovi && <span className="opacity-70">{v.nobovi}</span>}
                  {ageFmt(v.danais) && <span className="opacity-50">{ageFmt(v.danais)}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Vue globale ───────────────────────────────────── */
export default function GeneaClient({ roots }: { roots: AnimalGeneaNode[] }) {
  const [search, setSearch] = useState("");
  const [forceOpen, setForceOpen] = useState<boolean | null>(null);
  const [vue, setVue] = useState<"arbre" | "paysage" | "mere" | "pere" | "consang">("arbre");

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

      {/* Onglets */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: "arbre",   label: "🌳 Arbre" },
          { key: "paysage", label: "↔ Paysage" },
          { key: "mere",    label: "🐄 Par mère" },
          { key: "pere",    label: "🐂 Par père" },
          { key: "consang", label: "⚠ Consanguinité" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setVue(key)}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors
              ${vue === key ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

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

      {vue === "arbre" && (
        <>
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

          {/* Arbre — key change quand forceOpen change pour re-mount et appliquer defaultOpen */}
          <div key={String(forceOpen)} className="bg-white rounded-2xl shadow-lg p-4 space-y-1 overflow-x-auto">
            {filteredRoots.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">Aucun animal trouvé pour « {search} »</p>
            )}
            {filteredRoots.map((root, i) => (
              <GeneaNode
                key={root.id}
                node={root}
                depth={0}
                isLast={i === filteredRoots.length - 1}
                defaultOpen={forceOpen !== null ? forceOpen : true}
                highlight={highlight}
              />
            ))}
          </div>

          <p className="text-center text-xs text-gray-400">
            Les animaux sans mère connue dans la base sont affichés à la racine de l&apos;arbre.
          </p>
        </>
      )}

      {vue === "paysage" && <VuePaysage roots={filteredRoots} highlight={highlight} />}
      {vue === "mere"    && <VueParMere roots={roots} />}
      {vue === "pere"    && <VueParPere roots={roots} />}
      {vue === "consang" && <VueConsanguinite roots={roots} />}
    </div>
  );
}

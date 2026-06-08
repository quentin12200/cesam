"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import type { ArbreData, TreeNode } from "./page";

/* ─── Couleurs par rôle ─────────────────────────────── */
const COLORS = {
  taureau:    { bg: "bg-blue-600",   border: "border-blue-700",   text: "text-white",       dot: "#2563eb" },
  vache:      { bg: "bg-emerald-600",border: "border-emerald-700",text: "text-white",        dot: "#059669" },
  animal_M:   { bg: "bg-sky-500",    border: "border-sky-600",    text: "text-white",        dot: "#0ea5e9" },
  animal_F:   { bg: "bg-pink-500",   border: "border-pink-600",   text: "text-white",        dot: "#ec4899" },
  inconnu:    { bg: "bg-gray-300",   border: "border-gray-400",   text: "text-gray-600",     dot: "#9ca3af" },
};

function nodeColors(node: TreeNode, isCenter = false) {
  if (node.isTaureau) return COLORS.taureau;
  if (isCenter) return node.sexe === "M" ? COLORS.animal_M : COLORS.animal_F;
  return COLORS.vache;
}

/* ─── Badge nœud ────────────────────────────────────── */
function NodeCard({
  node,
  isCenter = false,
  label,
}: {
  node: TreeNode;
  isCenter?: boolean;
  label?: string;
}) {
  const c = nodeColors(node, isCenter);
  const href = node.isTaureau ? undefined : `/troupeau/${node.nutrav}`;
  const age = node.danais
    ? Math.floor((Date.now() - new Date(node.danais).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null;

  const inner = (
    <div
      className={`
        relative rounded-xl border-2 shadow-lg px-3 py-2.5 min-w-[110px] max-w-[140px]
        transition-transform hover:scale-105 cursor-pointer select-none
        ${c.bg} ${c.border} ${c.text}
        ${isCenter ? "ring-4 ring-white ring-offset-2 scale-110 shadow-2xl" : ""}
      `}
    >
      {label && (
        <div className="text-[9px] font-semibold uppercase tracking-widest opacity-70 mb-1">
          {label}
        </div>
      )}
      <div className="font-bold text-sm leading-tight truncate">{node.nutrav}</div>
      {node.nobovi && (
        <div className="text-xs opacity-85 truncate mt-0.5">{node.nobovi}</div>
      )}
      {age !== null && !node.isTaureau && (
        <div className="text-[10px] opacity-70 mt-1">
          {age} an{age > 1 ? "s" : ""}
        </div>
      )}
      {node.isTaureau && (
        <div className="text-[10px] opacity-70 mt-1">Taureau</div>
      )}
      {node.statut === "SORTI" && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gray-400 border border-white" title="Sorti" />
      )}
    </div>
  );

  if (!href) return inner;
  return <Link href={href}>{inner}</Link>;
}

/* ─── Nœud fantôme (père/mère inconnu) ─────────────── */
function UnknownCard({ label }: { label: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 min-w-[110px] max-w-[140px] text-center">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
        {label}
      </div>
      <div className="text-gray-400 text-xs">Inconnu</div>
    </div>
  );
}

/* ─── Connecteur SVG entre deux éléments ─────────────── */
function Connector({ fromRef, toRef, containerRef, color = "#d1d5db" }: {
  fromRef: React.RefObject<HTMLDivElement | null>;
  toRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  color?: string;
}) {
  const [path, setPath] = useState("");

  useEffect(() => {
    function compute() {
      const cont = containerRef.current;
      const from = fromRef.current;
      const to = toRef.current;
      if (!cont || !from || !to) return;
      const cRect = cont.getBoundingClientRect();
      const fRect = from.getBoundingClientRect();
      const tRect = to.getBoundingClientRect();

      // Sortie droite du nœud source → entrée gauche du nœud cible
      const x1 = fRect.right - cRect.left;
      const y1 = fRect.top + fRect.height / 2 - cRect.top;
      const x2 = tRect.left - cRect.left;
      const y2 = tRect.top + tRect.height / 2 - cRect.top;
      const cx = (x1 + x2) / 2;
      setPath(`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`);
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [fromRef, toRef, containerRef]);

  if (!path) return null;
  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      opacity={0.7}
    />
  );
}

/* ─── Composant principal ─────────────────────────────── */
export default function ArbreClient({ data }: { data: ArbreData }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs pour les nœuds (on en crée un par slot fixe)
  const refGrandMere  = useRef<HTMLDivElement>(null);
  const refGrandPere  = useRef<HTMLDivElement>(null);
  const refMere       = useRef<HTMLDivElement>(null);
  const refPere       = useRef<HTMLDivElement>(null);
  const refAnimal     = useRef<HTMLDivElement>(null);
  const refVeaux      = useRef<(HTMLDivElement | null)[]>([]);

  const hasGen2 = data.grandMere || data.grandPere;

  return (
    <div className="space-y-4">
      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 justify-center">
        {[
          { label: "Taureau",        c: "bg-blue-600" },
          { label: "Vache / femelle",c: "bg-emerald-600" },
          { label: "Mâle",           c: "bg-sky-500" },
          { label: "Femelle",        c: "bg-pink-500" },
        ].map(({ label, c }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${c}`} />
            {label}
          </span>
        ))}
        <span className="text-gray-400">· Cliquer sur un animal pour ouvrir sa fiche</span>
      </div>

      {/* Arbre */}
      <div
        ref={containerRef}
        className="relative bg-white rounded-2xl shadow-lg overflow-x-auto"
        style={{ minHeight: 340 }}
      >
        {/* SVG des lignes (par-dessus tout) */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: "100%", zIndex: 10 }}
        >
          {/* Grand-mère → Mère */}
          {data.grandMere && data.mere && (
            <Connector fromRef={refGrandMere} toRef={refMere} containerRef={containerRef} color="#10b981" />
          )}
          {/* Grand-père → Mère */}
          {data.grandPere && data.mere && (
            <Connector fromRef={refGrandPere} toRef={refMere} containerRef={containerRef} color="#2563eb" />
          )}
          {/* Mère → Animal */}
          {data.mere && (
            <Connector fromRef={refMere} toRef={refAnimal} containerRef={containerRef} color="#10b981" />
          )}
          {/* Père → Animal */}
          {data.pere && (
            <Connector fromRef={refPere} toRef={refAnimal} containerRef={containerRef} color="#2563eb" />
          )}
          {/* Animal → Veaux */}
          {data.veaux.map((_, i) => (
            <Connector
              key={i}
              fromRef={refAnimal}
              toRef={{ current: refVeaux.current[i] ?? null }}
              containerRef={containerRef}
              color="#6366f1"
            />
          ))}
        </svg>

        {/* Grille colonnes */}
        <div className="flex items-stretch gap-0 p-6 min-w-[640px]">

          {/* Colonne 0 : grands-parents (optionnel) */}
          {hasGen2 && (
            <div className="flex flex-col justify-center gap-6 pr-6 border-r border-dashed border-gray-200">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-center mb-2">
                Grands-parents
              </div>
              <div ref={refGrandMere} className="flex justify-center">
                {data.grandMere
                  ? <NodeCard node={data.grandMere} label="Grand-mère" />
                  : <UnknownCard label="Grand-mère" />}
              </div>
              <div ref={refGrandPere} className="flex justify-center">
                {data.grandPere
                  ? <NodeCard node={data.grandPere} label="Grand-père" />
                  : <UnknownCard label="Grand-père" />}
              </div>
            </div>
          )}

          {/* Colonne 1 : parents */}
          <div className="flex flex-col justify-center gap-6 px-8 border-r border-dashed border-gray-200">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-center mb-2">
              Parents
            </div>
            <div ref={refMere} className="flex justify-center">
              {data.mere
                ? <NodeCard node={data.mere} label="Mère" />
                : <UnknownCard label="Mère" />}
            </div>
            <div ref={refPere} className="flex justify-center">
              {data.pere
                ? <NodeCard node={data.pere} label="Père" />
                : <UnknownCard label="Père" />}
            </div>
          </div>

          {/* Colonne 2 : animal central */}
          <div className="flex flex-col items-center justify-center px-8 border-r border-dashed border-gray-200">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-center mb-4">
              Animal
            </div>
            <div ref={refAnimal} className="flex justify-center">
              <NodeCard node={data.animal} isCenter label="" />
            </div>
          </div>

          {/* Colonne 3 : veaux */}
          {data.veaux.length > 0 && (
            <div className="flex flex-col justify-center gap-3 pl-8">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-center mb-2">
                Descendance ({data.veaux.length})
              </div>
              {data.veaux.map((veau, i) => (
                <div
                  key={veau.id}
                  ref={(el) => { refVeaux.current[i] = el; }}
                  className="flex justify-start"
                >
                  <div className="relative">
                    <NodeCard node={veau} label={veau.pereNom ? `♂ ${veau.pereNom}` : undefined} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.veaux.length === 0 && (
            <div className="flex flex-col items-center justify-center pl-8 text-gray-400">
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-2">
                Descendance
              </div>
              <div className="text-xs italic">Aucun veau enregistré</div>
            </div>
          )}
        </div>
      </div>

      {/* Résumé texte */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.mere && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-emerald-700 mb-1">Mère</p>
            <Link href={`/troupeau/${data.mere.nutrav}`} className="font-mono font-bold text-emerald-800 hover:underline">
              {data.mere.nutrav}
            </Link>
            {data.mere.nobovi && <p className="text-sm text-emerald-700">{data.mere.nobovi}</p>}
          </div>
        )}
        {data.pere && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700 mb-1">Père</p>
            <p className="font-mono font-bold text-blue-800">{data.pere.nutrav}</p>
            {data.pere.nobovi && <p className="text-sm text-blue-700">{data.pere.nobovi}</p>}
          </div>
        )}
        {data.veaux.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-700 mb-1">
              Descendance ({data.veaux.length})
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {data.veaux.map((v) => (
                <Link
                  key={v.id}
                  href={`/troupeau/${v.nutrav}`}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold hover:opacity-80 ${
                    v.sexe === "M" ? "bg-sky-100 text-sky-800" : "bg-pink-100 text-pink-800"
                  }`}
                >
                  {v.nutrav}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import type { VachePerf } from "./page";

type SortKey = "score" | "ivv" | "gmq" | "velages";
type SortDir = "asc" | "desc";

function IvvBadge({ ivv }: { ivv: number | null }) {
  if (ivv === null) return <span className="text-gray-400 text-xs">—</span>;
  const delta = ivv - 365;
  const color =
    Math.abs(delta) <= 20
      ? "text-green-700 bg-green-50"
      : Math.abs(delta) <= 45
      ? "text-yellow-700 bg-yellow-50"
      : "text-red-700 bg-red-50";
  return (
    <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${color}`}>
      {ivv}j
    </span>
  );
}

function GmqBadge({ gmq }: { gmq: number | null }) {
  if (gmq === null) return <span className="text-gray-400 text-xs">—</span>;
  const color =
    gmq >= 1500
      ? "text-green-700 bg-green-50"
      : gmq >= 1200
      ? "text-yellow-700 bg-yellow-50"
      : "text-red-700 bg-red-50";
  return (
    <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${color}`}>
      {gmq.toLocaleString("fr-FR")} g/j
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 text-xs">—</span>;
  const color =
    score >= 75
      ? "bg-green-600 text-white"
      : score >= 50
      ? "bg-yellow-500 text-white"
      : "bg-red-500 text-white";
  return (
    <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${color}`}>
      {score}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const color =
    score >= 75 ? "bg-green-500" : score >= 50 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
    </div>
  );
}

function VelageRow({ v, i }: { v: VachePerf["velages"][0]; i: number }) {
  const date = new Date(v.date);
  const label = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 py-0.5">
      <span className="w-4 text-gray-400 text-right">{i + 1}.</span>
      <span className="font-medium w-24">{label}</span>
      {v.pereNom && <span className="text-gray-500 flex-1 truncate">{v.pereNom}</span>}
      {!v.pereNom && <span className="text-gray-300 flex-1">père inconnu</span>}
      {v.ivvJours !== null ? (
        <IvvBadge ivv={v.ivvJours} />
      ) : (
        <span className="text-gray-300 text-xs">1er vêlage</span>
      )}
    </div>
  );
}

function VeauRow({ v }: { v: VachePerf["veaux"][0] }) {
  const date = new Date(v.dateNaissance);
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 py-0.5">
      <span
        className={`w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold ${
          v.sexe === "M" ? "bg-blue-400" : "bg-pink-400"
        }`}
      >
        {v.sexe}
      </span>
      <Link href={`/troupeau/${v.nutrav}`} className="font-mono text-xs text-indigo-700 hover:underline w-20">
        {v.nutrav}
      </Link>
      {v.nobovi && <span className="text-gray-500 truncate w-20">{v.nobovi}</span>}
      <span className="text-gray-400 w-20">
        {date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
      </span>
      {v.pereNom && <span className="text-gray-500 flex-1 truncate">{v.pereNom}</span>}
      {!v.pereNom && <span className="flex-1" />}
      {v.poids1 !== null && v.poidsN !== null ? (
        <span className="text-gray-500 w-24 text-right">
          {v.poids1}→{v.poidsN} kg
        </span>
      ) : (
        <span className="text-gray-300 w-24 text-right">pas de pesées</span>
      )}
      <GmqBadge gmq={v.gmq} />
    </div>
  );
}

function VacheRow({ row }: { row: VachePerf }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {open ? (
              <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
            )}
            <div>
              <Link
                href={`/troupeau/${row.nutrav}`}
                className="font-mono font-bold text-green-700 text-xs bg-green-50 px-1.5 py-0.5 rounded hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {row.nutrav}
              </Link>
              {row.nobovi && (
                <span className="ml-2 text-gray-600 text-xs">{row.nobovi}</span>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-center text-gray-600 text-sm">{row.nbVelages}</td>
        <td className="px-3 py-3 text-center">
          <IvvBadge ivv={row.ivvMoyen} />
        </td>
        <td className="px-3 py-3 text-center">
          <GmqBadge gmq={row.gmqMoyen} />
          {row.nbVeauxAvecGmq > 0 && (
            <div className="text-[10px] text-gray-400 mt-0.5">
              {row.nbVeauxAvecGmq} veau{row.nbVeauxAvecGmq > 1 ? "x" : ""}
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex flex-col items-center gap-1">
            <ScoreBadge score={row.score} />
            <ScoreBar score={row.score} />
          </div>
        </td>
      </tr>
      {open && (
        <tr className="bg-indigo-50/30">
          <td colSpan={5} className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Historique vêlages */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Vêlages ({row.nbVelages})
                </p>
                {row.velages.length === 0 && (
                  <p className="text-xs text-gray-400">Aucun vêlage enregistré</p>
                )}
                {row.velages.map((v, i) => (
                  <VelageRow key={i} v={v} i={i} />
                ))}
                {row.ivvMin !== null && row.ivvMax !== null && (
                  <p className="text-[10px] text-gray-400 mt-2">
                    IVV min {row.ivvMin}j · max {row.ivvMax}j · moy {row.ivvMoyen}j · cible 365j
                  </p>
                )}
              </div>

              {/* Veaux */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Veaux ({row.veaux.length})
                  {row.nbVeauxAvecGmq > 0 && (
                    <span className="ml-2 normal-case font-normal text-gray-400">
                      — {row.nbVeauxAvecGmq} avec GMQ
                    </span>
                  )}
                </p>
                {row.veaux.length === 0 && (
                  <p className="text-xs text-gray-400">Aucun veau enregistré</p>
                )}
                {row.veaux.map((v) => (
                  <VeauRow key={v.veauId} v={v} />
                ))}
                {row.nbVeauxAvecGmq === 0 && row.veaux.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-2">
                    Aucune pesée enregistrée — GMQ non calculable
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function PerformancesClient({ data }: { data: VachePerf[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...data].sort((a, b) => {
    let valA: number | null;
    let valB: number | null;
    if (sortKey === "score") { valA = a.score; valB = b.score; }
    else if (sortKey === "ivv") { valA = a.ivvMoyen; valB = b.ivvMoyen; }
    else if (sortKey === "gmq") { valA = a.gmqMoyen; valB = b.gmqMoyen; }
    else { valA = a.nbVelages; valB = b.nbVelages; }

    if (valA === null && valB === null) return a.nutrav.localeCompare(b.nutrav);
    if (valA === null) return 1;
    if (valB === null) return -1;

    // Pour IVV : la meilleure valeur est la plus proche de 365, pas forcément la plus grande
    if (sortKey === "ivv") {
      const da = Math.abs(valA - 365);
      const db = Math.abs(valB - 365);
      return sortDir === "asc" ? db - da : da - db;
    }

    return sortDir === "desc" ? valB - valA : valA - valB;
  });

  // Stats globales
  const ivvValues = data.map((d) => d.ivvMoyen).filter((v): v is number => v !== null);
  const gmqValues = data.map((d) => d.gmqMoyen).filter((v): v is number => v !== null);
  const ivvGlobal = ivvValues.length > 0 ? Math.round(ivvValues.reduce((a, b) => a + b, 0) / ivvValues.length) : null;
  const gmqGlobal = gmqValues.length > 0 ? Math.round(gmqValues.reduce((a, b) => a + b, 0) / gmqValues.length) : null;

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp size={12} className="text-gray-300" />;
    return sortDir === "desc" ? (
      <ChevronDown size={12} className="text-indigo-500" />
    ) : (
      <ChevronUp size={12} className="text-indigo-500" />
    );
  }

  function ThBtn({ label, k, title }: { label: string; k: SortKey; title?: string }) {
    return (
      <th
        className="px-3 py-3 text-center cursor-pointer select-none hover:bg-gray-100"
        onClick={() => toggleSort(k)}
        title={title}
      >
        <div className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-500 whitespace-nowrap">
          {label}
          <SortIcon k={k} />
        </div>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI globaux */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{data.length}</div>
          <div className="text-xs text-gray-500 mt-1">vaches analysées</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-xl font-bold text-indigo-700">
            {ivvGlobal !== null ? `${ivvGlobal}j` : "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">IVV moyen</div>
          <div className="text-[10px] text-gray-400">cible 365j</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-xl font-bold text-green-700">
            {gmqGlobal !== null ? `${gmqGlobal} g/j` : "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">GMQ descendance</div>
          <div className="text-[10px] text-gray-400">cible 1 200 g/j</div>
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 px-1">
        <div>
          <span className="font-semibold text-gray-600">IVV</span> :{" "}
          <span className="px-1.5 rounded-full bg-green-50 text-green-700">≤ ±20j</span>{" "}
          <span className="px-1.5 rounded-full bg-yellow-50 text-yellow-700">±45j</span>{" "}
          <span className="px-1.5 rounded-full bg-red-50 text-red-700">&gt;±45j</span>
        </div>
        <div>
          <span className="font-semibold text-gray-600">GMQ</span> :{" "}
          <span className="px-1.5 rounded-full bg-green-50 text-green-700">≥1500</span>{" "}
          <span className="px-1.5 rounded-full bg-yellow-50 text-yellow-700">≥1200</span>{" "}
          <span className="px-1.5 rounded-full bg-red-50 text-red-700">&lt;1000</span>
        </div>
        <div className="text-gray-400">· Cliquer sur une ligne pour voir le détail</div>
      </div>

      {/* Tableau */}
      {data.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">
          Aucune vache active avec des vêlages.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                    Vache
                  </th>
                  <ThBtn label="Vêlages" k="velages" title="Nombre de vêlages enregistrés" />
                  <ThBtn
                    label="IVV moyen"
                    k="ivv"
                    title="Intervalle Vêlage-Vêlage — cible 365j. Tri = plus proche de 365j en premier"
                  />
                  <ThBtn
                    label="GMQ descendance"
                    k="gmq"
                    title="Gain Moyen Quotidien moyen de tous les veaux avec pesées"
                  />
                  <ThBtn
                    label="Score"
                    k="score"
                    title="Score combiné IVV + GMQ (0-100)"
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <VacheRow key={row.vacheId} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Explications */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-600 mb-2">Méthode de calcul</p>
        <p>
          • <strong>IVV</strong> = nombre de jours entre deux vêlages consécutifs — objectif 365j (1
          veau/an)
        </p>
        <p>
          • <strong>GMQ</strong> = (poids dernière pesée − poids 1ʳᵉ pesée) ÷ âge en jours —
          minimum 2 pesées
        </p>
        <p>
          • <strong>Score</strong> = moyenne de (score IVV + score GMQ) sur 100 — IVV : pénalité si
          éloigné de 365j ; GMQ : proportion de 1 200 g/j
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { GestationCalendarTable } from "./GestationCalendarTable";
import type { GestationCalendarRow } from "@/lib/gestation-calendar";

const LIMITE_MINIMALE = 5;
const PERIODE_PRIORITAIRE_JOURS = 10;
const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

export default function GestationCalendarSection({ rows, now }: { rows: GestationCalendarRow[]; now: Date }) {
  const [expanded, setExpanded] = useState(false);
  const aujourdHui = new Date(now);
  aujourdHui.setHours(0, 0, 0, 0);
  const finPeriode = new Date(aujourdHui.getTime() + PERIODE_PRIORITAIRE_JOURS * MS_PAR_JOUR);

  const prochainesDansDixJours = rows.filter((row) => {
    const date = new Date(row.dateVelagePrevue);
    return date >= aujourdHui && date <= finPeriode;
  });

  const dernierePrioritaire = rows.findLastIndex(
    (row) => new Date(row.dateVelagePrevue) <= finPeriode
  );
  const limiteInitiale =
    prochainesDansDixJours.length > LIMITE_MINIMALE
      ? dernierePrioritaire + 1
      : Math.min(LIMITE_MINIMALE, rows.length);

  const visible = expanded ? rows : rows.slice(0, limiteInitiale);
  const reste = rows.length - limiteInitiale;

  return (
    <>
      <GestationCalendarTable rows={visible} now={now} />
      {reste > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-500 hover:text-green-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>Réduire la liste <ChevronUp size={14} /></>
          ) : (
            <>Voir les {reste} suivant{reste > 1 ? "s" : ""} <ChevronDown size={14} /></>
          )}
        </button>
      )}
    </>
  );
}

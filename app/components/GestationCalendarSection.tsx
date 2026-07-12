"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { GestationCalendarTable } from "./GestationCalendarTable";
import type { GestationCalendarRow } from "@/lib/gestation-calendar";

const LIMITE_INITIALE = 10;

export default function GestationCalendarSection({ rows, now }: { rows: GestationCalendarRow[]; now: Date }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, LIMITE_INITIALE);
  const reste = rows.length - LIMITE_INITIALE;

  return (
    <>
      <GestationCalendarTable rows={visible} now={now} />
      {reste > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-500 hover:text-green-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
        >
          {expanded ? (
            <>Réduire <ChevronUp size={14} /></>
          ) : (
            <>Voir les {reste} autre{reste > 1 ? "s" : ""} <ChevronDown size={14} /></>
          )}
        </button>
      )}
    </>
  );
}

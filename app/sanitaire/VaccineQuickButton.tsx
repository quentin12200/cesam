"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  nutrav: string;
  vaccin: string;
  label: string;
  voie?: string;
  compact?: boolean;
}

export default function VaccineQuickButton({ nutrav, vaccin, label, voie = "IM", compact = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/vaccinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nutrav, vaccin, date: today, voie }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <span className={compact ? "text-green-600 font-bold text-xs" : "text-xs text-green-600 font-semibold"}>
        ✓
      </span>
    );
  }

  if (compact) {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/70 hover:bg-white font-bold text-xs text-current disabled:opacity-50 transition-colors shrink-0"
        title={`Enregistrer ${label}`}
      >
        {loading ? "…" : "+"}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs px-2.5 py-1 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-purple-700 active:scale-95 transition-all"
    >
      {loading ? "…" : label}
    </button>
  );
}

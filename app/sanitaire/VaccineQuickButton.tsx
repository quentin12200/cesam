"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  nutrav: string;
  vaccin: string;
  label: string;
}

export default function VaccineQuickButton({ nutrav, vaccin, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/vaccinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nutrav, vaccin, date: today, voie: "IM" }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) return <span className="text-xs text-green-600 font-semibold">✓ Enregistré</span>;

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

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";
import type { BouclageInfo } from "@/lib/bouclage";

export default function BouclageIndicator({ nutrav, boucleFaite, estConcerneParBouclage, onMarkedDone }: BouclageInfo & { nutrav: string; onMarkedDone?: () => void }) {
  const router = useRouter();
  const [done, setDone] = useState(boucleFaite);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    setDone(boucleFaite);
    setError(false);
    setSaving(false);
    busy.current = false;
    return () => { requestVersion.current += 1; };
  }, [nutrav, boucleFaite]);

  async function markDone(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (busy.current || done) return;
    const version = requestVersion.current;
    busy.current = true;
    setSaving(true);
    setError(false);
    try {
      const response = await fetch(`/api/animaux/${encodeURIComponent(nutrav)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boucleFaite: true }),
      });
      if (!response.ok) throw new Error("Bouclage failed");
      if (version !== requestVersion.current) return;
      setDone(true);
      onMarkedDone?.();
      router.refresh();
    } catch {
      if (version === requestVersion.current) setError(true);
    } finally {
      if (version === requestVersion.current) {
        busy.current = false;
        setSaving(false);
      }
    }
  }

  if (!estConcerneParBouclage) return null;

  return (
    <span className="relative inline-flex shrink-0 align-middle font-sans print:hidden" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}>
      {done ? (
        <span title="Bouclé" aria-label="Bouclé" className="inline-flex items-center text-green-700">
          <Tag aria-hidden="true" size={12} /><span aria-hidden="true" className="text-xs font-black">✓</span>
        </span>
      ) : (
        <button type="button" title="À boucler" aria-label={`À boucler : marquer ${nutrav} comme bouclé`} disabled={saving} aria-busy={saving} onClick={markDone} className="inline-flex h-11 w-7 shrink-0 items-center justify-center rounded text-amber-800 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 disabled:opacity-50">
          <Tag aria-hidden="true" size={12} /><span aria-hidden="true" className="text-xs font-black">{saving ? "…" : "!"}</span>
        </button>
      )}
      {error && <span role="alert" className="absolute left-0 top-full z-[60] w-40 rounded border border-red-200 bg-white p-2 text-xs font-medium text-red-700 shadow">Échec du bouclage. Réessayez.</span>}
    </span>
  );
}

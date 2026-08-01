"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, History, Scale, WifiOff } from "lucide-react";
import { FIELD_SESSION_STORAGE_KEY, parseStoredFieldSession } from "@/lib/field-weighing-session";
import { resolveHomeWeighingView, type HomeWeighingView } from "@/lib/home-weighing";

type ActiveResponse = {
  items?: Array<{ id: string; startedAt: string; _count?: { pesees?: number } }>;
};

const startFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default function HomeWeighingPanel() {
  const [view, setView] = useState<HomeWeighingView | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = parseStoredFieldSession(localStorage.getItem(FIELD_SESSION_STORAGE_KEY));
    async function load() {
      try {
        const response = await fetch("/api/weighing-sessions?status=ACTIVE&limit=1", { cache: "no-store" });
        if (!response.ok) throw new Error("offline");
        const result = await response.json() as ActiveResponse;
        const item = result.items?.[0];
        if (!cancelled) setView(resolveHomeWeighingView(item ? {
          id: item.id,
          startedAt: item.startedAt,
          count: item._count?.pesees ?? 0,
        } : null, cached, false));
      } catch {
        if (!cancelled) setView(resolveHomeWeighingView(null, cached, true));
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (!view) {
    return (
      <section aria-label="Chargement de la pesée" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-11 animate-pulse rounded bg-gray-100" />
      </section>
    );
  }

  const active = view.active;
  return (
    <section data-layout-section="accueil-pesee" data-layout-label="Pesée rapide" className="rounded-lg border-l-4 border-l-green-700 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Scale className="mt-0.5 shrink-0 text-green-800" size={24} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-gray-950">{active ? "Pesée en cours" : "Pesée rapide"}</h2>
            {view.offline && <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600"><WifiOff size={14} /> Hors connexion</span>}
          </div>
          {active ? (
            <p className="mt-1 text-sm text-gray-700">
              Début {startFormat.format(new Date(active.startedAt))} · {active.count} animal{active.count > 1 ? "aux" : ""}
              {view.pendingCount > 0 ? ` · ${view.pendingCount} en attente` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-600">Enregistrer les poids directement sur le terrain</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Link href="/troupeau/pesee" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-green-700 px-4 font-bold text-white">
          {active ? "Reprendre la séance" : "Démarrer une pesée"} <ArrowRight size={18} />
        </Link>
        {active && active.id !== "local" && active.count > 0 && (
          <Link href={`/troupeau/pesee/sessions/${active.id}`} className="flex min-h-11 items-center justify-center rounded-md border border-gray-400 px-4 text-sm font-semibold">Voir le récapitulatif</Link>
        )}
      </div>
      <Link href="/troupeau/pesee/sessions" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gray-700 underline">
        <History size={16} /> {active ? "Voir toutes les séances" : "Voir les séances"}
      </Link>
    </section>
  );
}

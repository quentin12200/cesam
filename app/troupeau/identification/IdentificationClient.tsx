"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Pencil, Tags } from "lucide-react";

export type VeauIdentification = {
  id: string;
  nutrav: string;
  nobovi: string | null;
  danais: string;
  ageJours: number;
  mereNutrav: string | null;
  mereNom: string | null;
  dateBouclage: string | null;
};

export default function IdentificationClient({
  aBoucler: initialABoucler,
  recemmentBoucles: initialRecents,
}: {
  aBoucler: VeauIdentification[];
  recemmentBoucles: VeauIdentification[];
}) {
  const [aBoucler, setABoucler] = useState(initialABoucler);
  const [recents, setRecents] = useState(initialRecents);
  const [loading, setLoading] = useState<string | null>(null);

  async function updateBouclage(veau: VeauIdentification, boucleFaite: boolean) {
    if (loading) return;
    if (!boucleFaite && !window.confirm(`Remettre ${veau.nutrav} dans la liste « À boucler » ?`)) return;
    setLoading(veau.id);
    try {
      const response = await fetch(`/api/animaux/${veau.nutrav}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boucleFaite }),
      });
      if (!response.ok) throw new Error("Modification impossible");

      if (boucleFaite) {
        setABoucler((items) => items.filter((item) => item.id !== veau.id));
        setRecents((items) => [{ ...veau, dateBouclage: new Date().toISOString() }, ...items]);
      } else {
        setRecents((items) => items.filter((item) => item.id !== veau.id));
        setABoucler((items) => [...items, { ...veau, dateBouclage: null }].sort((a, b) => b.ageJours - a.ageJours));
      }
    } finally {
      setLoading(null);
    }
  }

  function AnimalIdentity({ veau }: { veau: VeauIdentification }) {
    return (
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/troupeau/${veau.nutrav}`} className="font-mono text-sm font-bold text-green-800 hover:underline">
            {veau.nutrav}
          </Link>
          <span className="truncate text-sm font-semibold text-gray-900">{veau.nobovi ?? "Sans nom"}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {veau.ageJours} j
          {veau.mereNutrav ? ` · Mère ${veau.mereNutrav}${veau.mereNom ? ` — ${veau.mereNom}` : ""}` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags size={18} className="text-violet-600" />
            <h2 className="font-bold text-gray-900">Veaux à boucler</h2>
          </div>
          <span className="text-sm font-bold tabular-nums text-violet-700">{aBoucler.length}</span>
        </div>

        {aBoucler.length === 0 ? (
          <p className="rounded-lg bg-green-50 px-3 py-4 text-center text-sm font-semibold text-green-800">
            Tous les veaux sont bouclés
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {aBoucler.map((veau) => (
              <article key={veau.id} className="flex min-h-16 items-center gap-3 py-2.5">
                <AnimalIdentity veau={veau} />
                <button
                  type="button"
                  disabled={loading === veau.id}
                  onClick={() => updateBouclage(veau, true)}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-violet-100 px-3 text-xs font-bold text-violet-800 hover:bg-violet-200 disabled:opacity-50"
                >
                  <Check size={15} />
                  {loading === veau.id ? "…" : "Bouclé"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {recents.length > 0 && (
        <details className="group rounded-xl bg-white shadow">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3">
            <span className="text-sm font-bold text-gray-700">Bouclés récemment ({recents.length})</span>
            <ChevronDown size={17} className="text-gray-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="divide-y divide-gray-100 border-t border-gray-100 px-4">
            {recents.map((veau) => (
              <article key={veau.id} className="flex min-h-16 items-center gap-3 py-2.5">
                <AnimalIdentity veau={veau} />
                <div className="shrink-0 text-right">
                  {veau.dateBouclage && (
                    <p className="mb-1 text-[10px] text-gray-400">
                      {new Date(veau.dateBouclage).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={loading === veau.id}
                    onClick={() => updateBouclage(veau, false)}
                    aria-label={`Corriger le statut de ${veau.nutrav}`}
                    title="Remettre à boucler"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-violet-700 disabled:opacity-50"
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

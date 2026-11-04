"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type DuplicatePair = {
  keep: { id: string; number: string; name: string | null };
  remove: { id: string; number: string; name: string | null };
  confidence: "CERTAIN" | "A_VERIFIER";
  linkedAnimals: number;
  linkedBreedings: number;
};

export default function BullDuplicatesClient({ pairs }: { pairs: DuplicatePair[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  async function merge(pair: DuplicatePair) {
    const message = [
      `Conserver : ${pair.keep.number} · ${pair.keep.name ?? "Sans nom"}`,
      `Regrouper : ${pair.remove.number} · ${pair.remove.name ?? "Sans nom"}`,
      `Liens à transférer : ${pair.linkedAnimals} animaux, ${pair.linkedBreedings} saillies.`,
      pair.confidence === "A_VERIFIER"
        ? "Attention : correspondance probable seulement (numéro court et nom identiques). Confirme le numéro national avant la fusion."
        : "Numéro national complet identique.",
      "Cette opération est irréversible depuis cet écran. Confirmer la fusion ?",
    ].join("\\n");
    if (!window.confirm(message)) return;
    setBusy(pair.remove.id);
    setError(null);
    setLastResult(null);
    try {
      const response = await fetch("/api/taureaux/fusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keepId: pair.keep.id,
          removeId: pair.remove.id,
          confirmation: "FUSIONNER",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Fusion impossible.");
      } else {
        setLastResult(`Fusion terminée : ${result.animalsRelinked} liens animaux et ${result.breedingsRelinked} saillies transférés.`);
        router.refresh();
      }
    } catch {
      setError("Erreur de connexion, vérifie l'état avant de réessayer.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {lastResult && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{lastResult}</p>}
      {pairs.length === 0 && <p className="rounded-xl bg-white p-4 text-sm text-gray-600">Aucune paire de fiches Taureau pouvant être rapprochée avec suffisamment d'indices.</p>}
      {pairs.map((pair) => (
        <div key={pair.keep.id + pair.remove.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-600">{pair.confidence === "CERTAIN" ? "Même numéro national" : "À vérifier : numéro court et nom correspondants"}</p>
          <div className="mt-2 space-y-1 text-sm">
            <p><span className="text-gray-500">Conserver :</span> <strong>{pair.keep.number} · {pair.keep.name ?? "Sans nom"}</strong></p>
            <p><span className="text-gray-500">Regrouper :</span> <strong>{pair.remove.number} · {pair.remove.name ?? "Sans nom"}</strong></p>
            <p className="text-xs text-gray-600">{pair.linkedAnimals} liens vers des animaux · {pair.linkedBreedings} saillies à transférer</p>
          </div>
          <button type="button" disabled={busy !== null} onClick={() => merge(pair)}
            className="mt-3 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy === pair.remove.id ? "Fusion…" : "Vérifier et fusionner ces fiches"}
          </button>
        </div>
      ))}
    </div>
  );
}

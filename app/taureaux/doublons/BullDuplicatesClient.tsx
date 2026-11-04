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
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function merge(pair: DuplicatePair) {
    const description = `Conserver ${pair.keep.number} · ${pair.keep.name ?? "?"} et retirer ${pair.remove.number} · ${pair.remove.name ?? "?"} ? ${pair.linkedAnimals} animaux et ${pair.linkedBreedings} saillies seront rattachés à la fiche conservée. Cette fusion est irréversible depuis cet écran.`;
    if (!window.confirm(description)) return;
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/taureaux/fusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId: pair.keep.id, removeId: pair.remove.id, confirmation: "FUSIONNER" }),
      });
      const body = await response.json();
      if (!response.ok) {
        setFeedback(body.error ?? "Fusion refusée.");
      } else {
        setFeedback("Fusion enregistrée. Liens animaux et saillies conservés.");
        router.refresh();
      }
    } catch {
      setFeedback("Erreur de connexion. Vérifie le résultat avant de recommencer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {feedback && <p role="status" className="rounded-lg border p-3 text-sm">{feedback}</p>}
      {pairs.length === 0 && <p className="rounded-lg bg-white p-4 text-sm text-gray-600">Aucun doublon identifiable avec suffisamment de certitude.</p>}
      {pairs.map((pair) => (
        <section key={pair.keep.id + pair.remove.id} className="rounded-xl border bg-white p-4">
          <p className="text-sm font-bold">{pair.keep.number} · {pair.keep.name ?? "Sans nom"}</p>
          <p className="mt-1 text-sm text-gray-600">Autre fiche : {pair.remove.number} · {pair.remove.name ?? "Sans nom"}</p>
          <p className="mt-2 text-xs text-gray-500">{pair.confidence === "CERTAIN" ? "Numéro national identique" : "Numéro court et nom identiques : identité à vérifier"} · {pair.linkedAnimals} animaux · {pair.linkedBreedings} saillies</p>
          <button type="button" disabled={busy} onClick={() => merge(pair)}
            className="mt-3 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Vérifier et fusionner
          </button>
        </section>
      ))}
    </div>
  );
}

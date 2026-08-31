"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface AnimalAConfirmer {
  animalId: string;
  nutrav: string;
  nom: string | null;
}

export default function StatutsAConfirmer({ protocoleId, animaux }: { protocoleId: string; animaux: AnimalAConfirmer[] }) {
  const router = useRouter();
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tousSelectionnes = animaux.length > 0 && animaux.every((animal) => selection.has(animal.animalId));

  function basculer(id: string) {
    setSelection((actuelle) => {
      const suivante = new Set(actuelle);
      if (suivante.has(id)) suivante.delete(id);
      else suivante.add(id);
      return suivante;
    });
  }

  function enregistrer(statut: "PROTOCOLE_ACQUIS" | "PRIMO_A_FAIRE") {
    if (selection.size === 0) return;
    setErreur(null);
    startTransition(async () => {
      const reponse = await fetch(`/api/protocoles/${protocoleId}/statuts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalIds: [...selection], statut, source: "VACCINS_A_PREPARER" }),
      });
      if (!reponse.ok) {
        setErreur("Le statut n’a pas pu être enregistré.");
        return;
      }
      setSelection(new Set());
      router.refresh();
    });
  }

  return (
    <div className="border-b bg-amber-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-bold text-amber-950">
          <input
            type="checkbox"
            checked={tousSelectionnes}
            onChange={() => setSelection(tousSelectionnes ? new Set() : new Set(animaux.map((animal) => animal.animalId)))}
            className="size-4"
          />
          Statut à confirmer ({animaux.length})
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" disabled={pending || selection.size === 0} onClick={() => enregistrer("PROTOCOLE_ACQUIS")} className="min-h-10 rounded-lg border border-amber-400 bg-white px-3 text-xs font-semibold text-amber-950 disabled:opacity-40">Déjà primovaccinés</button>
          <button type="button" disabled={pending || selection.size === 0} onClick={() => enregistrer("PRIMO_A_FAIRE")} className="min-h-10 rounded-lg bg-amber-800 px-3 text-xs font-semibold text-white disabled:opacity-40">Primo à faire</button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {animaux.map((animal) => (
          <label key={animal.animalId} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs">
            <input type="checkbox" checked={selection.has(animal.animalId)} onChange={() => basculer(animal.animalId)} />
            <b className="font-mono">{animal.nutrav}</b>{animal.nom && <span className="text-gray-500">{animal.nom}</span>}
          </label>
        ))}
      </div>
      {erreur && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{erreur}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import SortieEditorModal, { SortieEditorValues } from "./SortieEditorModal";

interface Sortie {
  id: string;
  date: string;
  type: string;
  acheteur: string | null;
  poids: number | null;
  poidsVif: number | null;
  rendementCarcasse: number | null;
  prixKilo: number | null;
  prixDefinitifHT: number | null;
  prixPrevuHT: number | null;
  notes: string | null;
  causeMortalite: string | null;
  animalId: string;
  animal: { nutrav: string; nobovi: string | null };
}

export default function EditSortieDrawer({ sortie }: { sortie: Sortie }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function enregistrer(values: SortieEditorValues) {
    const res = await fetch(`/api/sorties/${sortie.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        poidsVif: null,
        rendementCarcasse: null,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Erreur serveur");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors"
        title="Modifier cette sortie">
        <Pencil size={13} />
        Modifier
      </button>

      {open && (
        <SortieEditorModal
          title="Modifier la sortie"
          animalLabel={`${sortie.animal.nutrav} — ${sortie.animal.nobovi ?? "Sans nom"}`}
          initial={{
            animalId: sortie.animalId,
            date: new Date(sortie.date).toISOString().slice(0, 10),
            type: sortie.type,
            acheteur: sortie.acheteur,
            poids: sortie.poids,
            prixKilo: sortie.prixKilo,
            prixDefinitifHT: sortie.prixDefinitifHT,
            notes: sortie.notes,
            causeMortalite: sortie.causeMortalite,
          }}
          onClose={() => setOpen(false)}
          onSubmit={enregistrer}
        />
      )}
    </>
  );
}


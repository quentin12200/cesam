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
  categorieSortie: string | null;
  sexeSortie: string | null;
  modeVente: string | null;
  poidsVifVente: number | null;
  prixKgVif: number | null;
  poidsCarcasse: number | null;
  prixKgCarcasse: number | null;
  animalId: string;
  animal: { nutrav: string; nobovi: string | null };
}

export default function EditSortieDrawer({ sortie }: { sortie: Sortie }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function enregistrer(values: SortieEditorValues) {
    const type = values.nature === "MORT" ? "MORT" : (values.modeVente === "VIF" ? "ELEVAGE" : "BOUCHERIE");
    const poids = values.modeVente === "VIF" ? values.poidsVifVente : values.poidsCarcasse;
    const prixKilo = values.modeVente === "VIF" ? values.prixKgVif : values.prixKgCarcasse;
    const res = await fetch(`/api/sorties/${sortie.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values, type, poids, prixKilo,
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
            nature: sortie.type === "MORT" ? "MORT" : "VENTE",
            categorieSortie: sortie.categorieSortie,
            sexeSortie: sortie.sexeSortie,
            modeVente: sortie.modeVente ?? (sortie.type === "BOUCHERIE" ? "CARCASSE" : "VIF"),
            acheteur: sortie.acheteur,
            poidsVifVente: sortie.poidsVifVente ?? (sortie.type === "ELEVAGE" ? sortie.poids : null),
            prixKgVif: sortie.prixKgVif ?? (sortie.type === "ELEVAGE" ? sortie.prixKilo : null),
            poidsCarcasse: sortie.poidsCarcasse ?? (sortie.type === "BOUCHERIE" ? sortie.poids : null),
            prixKgCarcasse: sortie.prixKgCarcasse ?? (sortie.type === "BOUCHERIE" ? sortie.prixKilo : null),
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


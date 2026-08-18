"use client";

import { useRouter } from "next/navigation";
import SortieEditorModal, { SortieEditorValues } from "./SortieEditorModal";

interface Animal {
  id: string;
  nutrav: string;
  nobovi: string | null;
  sexbov: string;
  categorie: string | null;
  poidsVif?: number | null;
}

interface Props {
  animaux: Animal[];
  annee: number;
  initialAnimalId?: string;
  initialAnimalIds?: string[];
  returnTo?: string;
}

export default function SortieForm({ animaux, annee, initialAnimalId, initialAnimalIds, returnTo }: Props) {
  const router = useRouter();

  function fermer() {
    router.push(returnTo ?? `/finances?annee=${annee}`);
  }

  async function enregistrer(values: SortieEditorValues) {
    const type = values.nature === "MORT" ? "MORT" : (values.modeVente === "VIF" ? "ELEVAGE" : "BOUCHERIE");
    const poids = values.modeVente === "VIF" ? values.poidsVifVente : values.poidsCarcasse;
    const prixKilo = values.modeVente === "VIF" ? values.prixKgVif : values.prixKgCarcasse;
    const res = await fetch("/api/sorties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, type, poids, prixKilo }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Erreur serveur");
    fermer();
    router.refresh();
  }

  const animalSelectionne = animaux.find((animal) => animal.id === initialAnimalId);

  return (
    <SortieEditorModal
      title={initialAnimalIds ? "Vendre / sortir des animaux" : "Enregistrer une sortie"}
      animalLabel={animalSelectionne ? `${animalSelectionne.nutrav} — ${animalSelectionne.nobovi ?? "Sans nom"}` : undefined}
      animals={animaux}
      initialAnimalIds={initialAnimalIds}
      submitLabel={initialAnimalIds ? "Enregistrer la vente groupée" : undefined}
      initial={{
        animalId: initialAnimalId,
        date: new Date().toISOString().slice(0, 10),
        nature: "VENTE",
      }}
      onClose={fermer}
      onSubmit={enregistrer}
    />
  );
}


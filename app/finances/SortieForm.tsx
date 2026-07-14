"use client";

import { useRouter } from "next/navigation";
import SortieEditorModal, { SortieEditorValues } from "./SortieEditorModal";

interface Animal {
  id: string;
  nutrav: string;
  nobovi: string | null;
  sexbov: string;
}

interface Props {
  animaux: Animal[];
  annee: number;
  initialAnimalId?: string;
}

export default function SortieForm({ animaux, annee, initialAnimalId }: Props) {
  const router = useRouter();

  function fermer() {
    router.push(`/finances?annee=${annee}`);
  }

  async function enregistrer(values: SortieEditorValues) {
    const res = await fetch("/api/sorties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Erreur serveur");
    fermer();
    router.refresh();
  }

  const animalSelectionne = animaux.find((animal) => animal.id === initialAnimalId);

  return (
    <SortieEditorModal
      title="Enregistrer une sortie"
      animalLabel={animalSelectionne ? `${animalSelectionne.nutrav} — ${animalSelectionne.nobovi ?? "Sans nom"}` : undefined}
      animals={animaux}
      initial={{
        animalId: initialAnimalId,
        date: new Date().toISOString().slice(0, 10),
        type: "ELEVAGE",
      }}
      onClose={fermer}
      onSubmit={enregistrer}
    />
  );
}


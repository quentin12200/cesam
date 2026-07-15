"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QuickActionButton from "@/components/QuickActionButton";
import type { ActionVisualKey } from "@/components/action-visuals";
import AnimalPickerModal from "@/app/sanitaire/nouvel-evenement/AnimalPickerModal";
import type { AnimalOption } from "@/app/sanitaire/nouvel-evenement/AnimalPicker";

type ActionRapide = "chaleur" | "saillie" | "evenement";

interface Groupe {
  id: string;
  nom: string;
}

const actions = [
  { id: "chaleur", visual: "chaleur" },
  { id: "saillie", visual: "saillieIA" },
  { id: "evenement", visual: "evenementSanitaire" },
] satisfies { id: ActionRapide; visual: ActionVisualKey }[];

export default function AccueilQuickActions() {
  const router = useRouter();
  const [action, setAction] = useState<ActionRapide | null>(null);
  const [selection, setSelection] = useState<AnimalOption[]>([]);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [groupesCharges, setGroupesCharges] = useState(false);

  function ouvrir(actionChoisie: ActionRapide) {
    setAction(actionChoisie);
    setSelection([]);
    if (!groupesCharges) {
      setGroupesCharges(true);
      fetch("/api/groupes")
        .then((response) => response.json())
        .then((data: Groupe[]) => setGroupes(data))
        .catch(() => setGroupes([]));
    }
  }

  function continuer(animaux: AnimalOption[]) {
    setSelection(animaux);
    if (!action || animaux.length === 0) return;

    if (action === "evenement") {
      const nutravs = animaux.map((animal) => animal.nutrav).join(",");
      router.push(`/sanitaire/nouvel-evenement?animaux=${encodeURIComponent(nutravs)}`);
      return;
    }

    const ids = animaux.map((animal) => animal.id).join(",");
    router.push(`/reproduction?action=${action}&animaux=${encodeURIComponent(ids)}`);
  }

  return (
    <>
      <section aria-label="Actions rapides" className="grid grid-cols-3 gap-2">
        {actions.map(({ id, visual }) => (
          <QuickActionButton
            key={id}
            action={visual}
            onClick={() => ouvrir(id)}
            className="w-full"
          />
        ))}
      </section>

      {action && (
        <AnimalPickerModal
          selected={selection}
          onChange={continuer}
          onClose={() => setAction(null)}
          groupes={groupes}
          sexeImpose={action === "evenement" ? undefined : "F"}
        />
      )}
    </>
  );
}

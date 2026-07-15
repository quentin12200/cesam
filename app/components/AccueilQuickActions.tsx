"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Syringe, Stethoscope, Thermometer } from "lucide-react";
import AnimalPickerModal from "@/app/sanitaire/nouvel-evenement/AnimalPickerModal";
import type { AnimalOption } from "@/app/sanitaire/nouvel-evenement/AnimalPicker";

type ActionRapide = "chaleur" | "saillie" | "evenement";

interface Groupe {
  id: string;
  nom: string;
}

const actions = [
  { id: "chaleur", label: "Chaleur", icon: Thermometer },
  { id: "saillie", label: "Saillie / IA", icon: Syringe },
  { id: "evenement", label: "Événement", icon: Stethoscope },
] satisfies { id: ActionRapide; label: string; icon: typeof Thermometer }[];

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
        {actions.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => ouvrir(id)}
            className="min-h-14 rounded-lg border border-gray-200 bg-white px-2 py-2.5 text-gray-700 shadow-sm transition-colors hover:border-green-300 hover:bg-green-50 active:bg-green-100 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2"
          >
            <Icon size={19} className="text-green-700 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold leading-tight text-center">{label}</span>
          </button>
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

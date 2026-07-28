"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { useReproductionModal } from "@/app/components/ReproductionModalProvider";

interface Props {
  animalId: string;
  animalNumber: string;
  animalName?: string | null;
  heatDate: string;
  day: number;
  hasBreedingAfterHeat: boolean;
  variant: "animal" | "home";
  simulation?: boolean;
}

export default function HeatReturnReminder({
  animalId,
  animalNumber,
  animalName,
  heatDate,
  day,
  hasBreedingAfterHeat,
  variant,
  simulation = false,
}: Props) {
  const { openReproductionModal } = useReproductionModal();
  if (simulation) return null;

  const animalLabel = `${animalNumber}${animalName ? ` — ${animalName}` : ""}`;
  const formattedHeatDate = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(heatDate));

  const openHeatForm = () => {
    openReproductionModal({
      action: "chaleur",
      animals: [{ id: animalId, nutrav: animalNumber, nom: animalName }],
    });
  };

  return (
    <section
      aria-label="Surveillance du retour en chaleur"
      className={`rounded-xl border border-amber-200 bg-amber-50 p-3 ${variant === "animal" ? "mx-3 mt-2" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <Eye size={18} className="mt-0.5 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-950">
            {hasBreedingAfterHeat ? "Retour en chaleur à surveiller" : "Nouvelle chaleur possible"}
          </p>
          <p className="mt-0.5 text-xs text-amber-900">
            {hasBreedingAfterHeat
              ? `${animalLabel} a été saillie ou inséminée après cette chaleur. Une nouvelle chaleur peut indiquer que la fécondation n’a pas fonctionné.`
              : `Surveiller ${animalLabel} pour détecter un éventuel retour en chaleur.`}
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-800">
            Chaleur du {formattedHeatDate} · J{day} après la chaleur
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openHeatForm}
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-amber-700 px-3 text-sm font-semibold text-white hover:bg-amber-800"
            >
              Enregistrer une chaleur
            </button>
            {variant === "home" && (
              <Link
                href={`/troupeau/${encodeURIComponent(animalNumber)}`}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900"
              >
                Voir la fiche
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

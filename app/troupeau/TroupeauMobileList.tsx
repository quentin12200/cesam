"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Settings2, X } from "lucide-react";
import { differenceInDays } from "date-fns";
import NutravBadge from "@/app/components/NutravBadge";
import ReproductionListBadge from "@/app/components/ReproductionListBadge";
import {
  formatAgeCompact,
  getCategorie,
  getCategorieColor,
  getCategorieLabel,
  getEtatGestation,
  type EtatGestation,
} from "@/lib/utils";
import {
  DEFAULT_MOBILE_DISPLAY_PREFERENCES,
  formatFather,
  gestationDaysForDisplay,
  parseMobileDisplayPreferences,
  serializeMobileDisplayPreferences,
  type MobileDisplayKey,
  type MobileDisplayPreferences,
} from "@/lib/troupeau-display";
import type { AnimalRow } from "./TroupeauTableau";

export const TROUPEAU_MOBILE_DISPLAY_STORAGE_KEY = "cesam:troupeau-mobile-display:v1";

const OPTIONS: { key: MobileDisplayKey; label: string }[] = [
  { key: "age", label: "Âge" },
  { key: "weight", label: "Dernier poids" },
  { key: "category", label: "Catégorie" },
  { key: "mother", label: "Mère" },
  { key: "father", label: "Père" },
  { key: "reproduction", label: "Reproduction" },
  { key: "notWeaned", label: "Non sevré" },
  { key: "group", label: "Groupe" },
];

const REPRODUCTION_LABELS: Record<string, string> = {
  ROSE: "Imminente",
  JAUNE: "À écho",
  GRIS: "En attente",
  REPOS: "Repos",
  ROUGE: "Vide",
};

function copyDefaultPreferences(): MobileDisplayPreferences {
  return {
    visible: [...DEFAULT_MOBILE_DISPLAY_PREFERENCES.visible],
    gestation: DEFAULT_MOBILE_DISPLAY_PREFERENCES.gestation,
  };
}

export default function TroupeauMobileList({
  animaux,
  postCalvingRestDays,
}: {
  animaux: AnimalRow[];
  postCalvingRestDays: number;
}) {
  const [preferences, setPreferences] = useState<MobileDisplayPreferences>(copyDefaultPreferences);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setPreferences(parseMobileDisplayPreferences(localStorage.getItem(TROUPEAU_MOBILE_DISPLAY_STORAGE_KEY)));
  }, []);

  function savePreferences(next: MobileDisplayPreferences) {
    setPreferences(next);
    localStorage.setItem(TROUPEAU_MOBILE_DISPLAY_STORAGE_KEY, serializeMobileDisplayPreferences(next));
  }

  function toggleVisible(key: MobileDisplayKey) {
    const visible = preferences.visible.includes(key)
      ? preferences.visible.filter((item) => item !== key)
      : [...preferences.visible, key];
    savePreferences({ ...preferences, visible });
  }

  function isVisible(key: MobileDisplayKey) {
    return preferences.visible.includes(key);
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm"
          aria-expanded={settingsOpen}
        >
          <Settings2 size={15} /> Affichage
        </button>
      </div>

      {settingsOpen && (
        <section className="rounded-xl border border-green-100 bg-white p-3 shadow-sm" aria-label="Réglages d’affichage du troupeau">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Informations visibles</h3>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="grid min-h-9 min-w-9 place-items-center rounded-lg text-gray-500"
              aria-label="Fermer les réglages d’affichage"
            >
              <X size={17} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {OPTIONS.map((option) => {
              const active = isVisible(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggleVisible(option.key)}
                  className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    active
                      ? "border-green-700 bg-green-700 text-white"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                  aria-pressed={active}
                >
                  {active ? "✓ " : ""}{option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="mb-2 text-xs font-semibold text-gray-700">Affichage gestation</p>
            <div className="flex gap-2">
              {([
                ["simple", "Simple"],
                ["duration", "Avec durée"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => savePreferences({ ...preferences, gestation: value })}
                  className={`min-h-9 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    preferences.gestation === value
                      ? "border-green-700 bg-green-50 text-green-800"
                      : "border-gray-200 text-gray-600"
                  }`}
                  aria-pressed={preferences.gestation === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => savePreferences(copyDefaultPreferences())}
            className="mt-3 min-h-9 text-xs font-semibold text-green-700 underline-offset-2 hover:underline"
          >
            Réinitialiser l’affichage
          </button>
        </section>
      )}

      {animaux.map((animal) => {
        const birthDate = new Date(animal.danais);
        const category = getCategorie(animal.sexbov, birthDate, animal.estGenisse, animal.categorie);
        const categoryLabel = getCategorieLabel(animal.sexbov, birthDate, animal.estGenisse, animal.categorie);
        const categoryColor = getCategorieColor(category);
        const reproduction: EtatGestation | null =
          ["VACHE", "MOYENNE_GENISSE", "GRANDE_GENISSE", "A_ENGRAISSER"].includes(category)
            ? animal.reproductionEtatManuel ?? getEtatGestation(
                animal.saillieDate ? new Date(animal.saillieDate) : null,
                animal.gestationEtat,
                animal.gestationVelagePrevue ? new Date(animal.gestationVelagePrevue) : null,
                animal.velageDate ? new Date(animal.velageDate) : null,
                false,
                postCalvingRestDays
              )
            : null;
        const gestationDays =
          reproduction === "VERT" && animal.gestationEtat === "VERT" && animal.saillieDate
            ? differenceInDays(new Date(), new Date(animal.saillieDate))
            : null;
        const father = formatFather(animal.pereNom, animal.pereNumero);

        return (
          <article key={animal.id} className="rounded-xl bg-white p-3 shadow-sm">
            <Link href={`/troupeau/${animal.nutrav}`} className="flex min-h-10 items-center gap-2">
              <NutravBadge nutrav={animal.nutrav} className="!bg-emerald-600" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
                {animal.nobovi ?? <span className="font-medium italic text-gray-400">Sans nom</span>}
              </span>
              <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-gray-400" />
            </Link>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              {isVisible("reproduction") && reproduction && (
                <ReproductionListBadge
                  etat={reproduction}
                  fallbackLabel={REPRODUCTION_LABELS[reproduction] ?? reproduction}
                  gestationDays={gestationDaysForDisplay(preferences.gestation, gestationDays)}
                />
              )}
              {isVisible("reproduction") && animal.aEchographier && reproduction !== "JAUNE" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">À écho</span>
              )}
              {isVisible("age") && <span className="rounded-full bg-gray-50 px-2 py-0.5 text-gray-600">{formatAgeCompact(birthDate)}</span>}
              {isVisible("weight") && animal.dernierPoids !== null && (
                <span className="rounded-full bg-gray-50 px-2 py-0.5 font-semibold text-gray-700">
                  {animal.dernierPoids} kg
                  {animal.dernierePeseeDate && (
                    <span className="ml-1 font-normal text-gray-400">· {differenceInDays(new Date(), new Date(animal.dernierePeseeDate))} j</span>
                  )}
                </span>
              )}
              {isVisible("category") && (
                <span className={`rounded-full px-2 py-0.5 ${categoryColor}`}>
                  {animal.sexbov === "F" ? "♀" : "♂"} {categoryLabel}
                </span>
              )}
              {isVisible("mother") && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-800">Mère {animal.mereNutrav ?? "—"}</span>}
              {isVisible("father") && <span className="max-w-full truncate rounded-full bg-sky-50 px-2 py-0.5 text-sky-800">Père {father}</span>}
              {isVisible("notWeaned") && !animal.sevreFait && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">🍼 Non sevrée</span>
              )}
              {isVisible("group") && animal.groupeNom && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{animal.groupeNom}</span>
              )}
              {animal.enAttente && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">⛔ Vente interdite</span>
              )}
              {animal.activeCalves.map((calf) => calf.href ? (
                <Link key={calf.nutrav} href={calf.href} className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono font-bold text-blue-700">
                  🍼{calf.nutrav}
                </Link>
              ) : (
                <span key={calf.nutrav} className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono font-bold text-blue-700">🍼{calf.nutrav}</span>
              ))}
            </div>
          </article>
        );
      })}

      {animaux.length === 0 && (
        <div className="rounded-xl bg-white py-12 text-center text-gray-500 shadow">Aucun animal trouvé</div>
      )}
    </div>
  );
}

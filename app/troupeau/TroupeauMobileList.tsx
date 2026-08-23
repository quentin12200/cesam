"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Settings2, X } from "lucide-react";
import { differenceInDays } from "date-fns";
import { useRouter } from "next/navigation";
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
  shouldDisplayNonWeaned,
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

const COMMERCIAL_STATUS: Record<string, string> = {
  A_ENGRAISSER: "À engraisser",
  ENGRAISSEMENT: "Engraissement",
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
  const router = useRouter();
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
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm"
          aria-expanded={settingsOpen}
        >
          <Settings2 size={15} /> Affichage
        </button>
      </div>

      {settingsOpen && (
        <section className="rounded-2xl border border-green-100 bg-white p-3 shadow-sm" aria-label="Réglages d’affichage du troupeau">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Informations visibles</h3>
            <button type="button" onClick={() => setSettingsOpen(false)} className="grid min-h-9 min-w-9 place-items-center rounded-lg text-gray-500" aria-label="Fermer les réglages d’affichage">
              <X size={17} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {OPTIONS.map((option) => {
              const active = isVisible(option.key);
              return (
                <button key={option.key} type="button" onClick={() => toggleVisible(option.key)} className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? "border-green-700 bg-green-700 text-white" : "border-gray-200 bg-gray-50 text-gray-600"}`} aria-pressed={active}>
                  {active ? "✓ " : ""}{option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="mb-2 text-xs font-semibold text-gray-700">Affichage gestation</p>
            <div className="flex gap-2">
              {([["simple", "Simple"], ["duration", "Avec durée"]] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => savePreferences({ ...preferences, gestation: value })} className={`min-h-9 rounded-lg border px-3 py-1.5 text-xs font-semibold ${preferences.gestation === value ? "border-green-700 bg-green-50 text-green-800" : "border-gray-200 text-gray-600"}`} aria-pressed={preferences.gestation === value}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => savePreferences(copyDefaultPreferences())} className="mt-3 min-h-9 text-xs font-semibold text-green-700 underline-offset-2 hover:underline">
            Réinitialiser l’affichage
          </button>
        </section>
      )}

      {animaux.map((animal) => {
        const birthDate = new Date(animal.danais);
        const commercialStatus = animal.categorie ? COMMERCIAL_STATUS[animal.categorie] : null;
        const typeCategory = getCategorie(animal.sexbov, birthDate, animal.estGenisse, commercialStatus ? null : animal.categorie);
        const categoryLabel = getCategorieLabel(animal.sexbov, birthDate, animal.estGenisse, commercialStatus ? null : animal.categorie);
        const categoryColor = getCategorieColor(typeCategory);
        const reproduction: EtatGestation | null =
          ["VACHE", "MOYENNE_GENISSE", "GRANDE_GENISSE", "A_ENGRAISSER"].includes(typeCategory)
            ? animal.reproductionEtatManuel ?? getEtatGestation(
                animal.saillieDate ? new Date(animal.saillieDate) : null,
                animal.gestationEtat,
                animal.gestationVelagePrevue ? new Date(animal.gestationVelagePrevue) : null,
                animal.velageDate ? new Date(animal.velageDate) : null,
                false,
                postCalvingRestDays
              )
            : null;
        const gestationDays = reproduction === "VERT" && animal.gestationEtat === "VERT" && animal.saillieDate
          ? differenceInDays(new Date(), new Date(animal.saillieDate))
          : null;
        const father = formatFather(animal.pereNom, animal.pereNumero);
        const showMother = isVisible("mother") && Boolean(animal.mereNutrav);
        const showFather = isVisible("father") && father !== "—";
        const showFiliation = showMother || showFather;
        const showNonWeaned = isVisible("notWeaned") && shouldDisplayNonWeaned(birthDate, animal.sevreFait);
        const showWeight = isVisible("weight") && animal.dernierPoids !== null;
        const showGroup = isVisible("group") && Boolean(animal.groupeNom);
        const showEcho = isVisible("reproduction") && animal.aEchographier && reproduction !== "JAUNE";
        const href = `/troupeau/${animal.nutrav}`;

        function openAnimal() {
          sessionStorage.setItem("troupeau:scrollY", String(window.scrollY));
          router.push(href);
        }

        return (
          <article
            key={animal.id}
            role="link"
            tabIndex={0}
            onClick={openAnimal}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openAnimal();
              }
            }}
            className="cursor-pointer rounded-2xl border border-gray-100 bg-white px-3.5 py-3 shadow-[0_2px_12px_rgba(15,23,42,0.05)] outline-none transition active:scale-[0.995] focus-visible:ring-2 focus-visible:ring-green-600"
            aria-label={`Ouvrir la fiche de ${animal.nutrav}`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <NutravBadge nutrav={animal.nutrav} className="!bg-emerald-700 !px-2.5 !py-1.5 !text-sm" />
              <h3 className="min-w-0 flex-1 truncate text-[15px] font-extrabold tracking-tight text-gray-900">
                {animal.nobovi ?? <span className="font-medium italic text-gray-400">Sans nom</span>}
              </h3>
            </div>

            <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
              <div className="min-w-0">
                {commercialStatus ? (
                  <span className="text-sm font-bold text-amber-700">{commercialStatus}</span>
                ) : isVisible("reproduction") && reproduction ? (
                  <ReproductionListBadge etat={reproduction} fallbackLabel={REPRODUCTION_LABELS[reproduction] ?? reproduction} gestationDays={gestationDaysForDisplay(preferences.gestation, gestationDays)} className="!px-2.5 !py-1 !text-xs !font-bold" />
                ) : (
                  <span />
                )}
              </div>
              {isVisible("age") && <span className="font-mono text-sm font-bold tabular-nums text-gray-600">{formatAgeCompact(birthDate)}</span>}

              {isVisible("category") && (
                <span className={`w-fit rounded-lg px-2 py-1 text-xs font-semibold ${categoryColor}`}>
                  {animal.sexbov === "F" ? "♀" : "♂"} {categoryLabel}
                </span>
              )}
              {animal.activeCalves.length > 0 && (
                <div className="flex max-w-[8rem] flex-wrap justify-end gap-1.5">
                  {animal.activeCalves.map((calf) => calf.href ? (
                    <Link key={calf.nutrav} href={calf.href} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} className="max-w-[8rem] truncate rounded-lg bg-blue-50 px-2 py-1 font-mono text-xs font-bold text-blue-700">
                      🍼 {calf.name ?? calf.nutrav}
                    </Link>
                  ) : (
                    <span key={calf.nutrav} className="max-w-[8rem] truncate rounded-lg bg-blue-50 px-2 py-1 font-mono text-xs font-bold text-blue-700">🍼 {calf.name ?? calf.nutrav}</span>
                  ))}
                </div>
              )}
            </div>

            {(showNonWeaned || showWeight || showGroup || animal.enAttente || showEcho) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 pt-2 text-[11px]">
                {showNonWeaned && <span className="font-semibold text-blue-700">🍼 Non sevré</span>}
                {showWeight && (
                  <span className="font-semibold text-gray-700">
                    {animal.dernierPoids} kg
                    {animal.dernierePeseeDate && <span className="ml-1 font-normal text-gray-400">· {differenceInDays(new Date(), new Date(animal.dernierePeseeDate))} j</span>}
                  </span>
                )}
                {showGroup && <span className="text-gray-500">{animal.groupeNom}</span>}
                {animal.enAttente && <span className="font-bold text-red-700">⛔ Vente interdite</span>}
                {showEcho && <span className="font-bold text-amber-700">À écho</span>}
              </div>
            )}

            {showFiliation && (
              <details className="group mt-2 border-t border-gray-100 pt-1.5" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 text-[11px] font-semibold text-gray-500">
                  <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
                  Filiation
                </summary>
                <div className="grid grid-cols-2 gap-2 pb-1 text-xs">
                  {showMother && (
                    <div className="min-w-0 rounded-lg bg-gray-50 px-2.5 py-2">
                      <span className="block text-[10px] uppercase tracking-wide text-gray-400">Mère</span>
                      <strong className="font-mono text-gray-800">{animal.mereNutrav}</strong>
                    </div>
                  )}
                  {showFather && (
                    <div className="min-w-0 rounded-lg bg-gray-50 px-2.5 py-2">
                      <span className="block text-[10px] uppercase tracking-wide text-gray-400">Père</span>
                      <strong className="break-words text-gray-800">{father}</strong>
                    </div>
                  )}
                </div>
              </details>
            )}
          </article>
        );
      })}

      {animaux.length === 0 && <div className="rounded-xl bg-white py-12 text-center text-gray-500 shadow">Aucun animal trouvé</div>}
    </div>
  );
}

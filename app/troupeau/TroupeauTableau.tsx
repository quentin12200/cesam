"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { differenceInDays } from "date-fns";
import {
  getCategorie,
  getCategorieLabel,
  getCategorieColor,
  getEtatGestation,
  formatAgeCompact,
  type EtatGestation,
} from "@/lib/utils";
import ReproductionListBadge from "@/app/components/ReproductionListBadge";
import { getMotherWeaningDisplay } from "@/lib/troupeau-mother-weaning";
import { formatFather } from "@/lib/troupeau-display";

export interface AnimalRow {
  id: string;
  nutrav: string;
  nobovi: string | null;
  danais: string;
  sexbov: string;
  estGenisse: boolean;
  aEchographier: boolean;
  reproductionEtatManuel: EtatGestation | null;
  reproductionEtatPrecedent: EtatGestation | null;
  categorie: string | null;
  groupeNom: string | null;
  saillieDate: string | null;
  gestationEtat: string | null;
  gestationVelagePrevue: string | null;
  velageDate: string | null;
  mereNutrav: string | null;
  pereNom: string | null;
  pereNumero: string | null;
  sevreFait: boolean;
  activeCalves: { nutrav: string; href: string | null }[];
  dernierPoids: number | null;
  dernierePeseeDate: string | null;
  enAttente: boolean;
}

interface Props {
  animaux: AnimalRow[];
  postCalvingRestDays: number;
}

interface FilterOption {
  value: string | undefined;
  label: string;
}

const ETAT_LABEL: Record<string, string> = {
  VERT: "Gestante",
  ROSE: "Imminente",
  JAUNE: "À écho",
  GRIS: "En attente",
  ROUGE: "Vide",
  REPOS: "Repos",
};

const CATS_OPTIONS: FilterOption[] = [
  { value: undefined, label: "Toutes catégories" },
  { value: "VACHE", label: "♀ Vaches" },
  { value: "GRANDE_GENISSE", label: "♀ Grande génisse" },
  { value: "MOYENNE_GENISSE", label: "♀ Moy. génisse" },
  { value: "PETITE_GENISSE", label: "♀ Petite génisse" },
  { value: "PRESELECTION_GENISSE", label: "♀ Présélection" },
  { value: "VELLE", label: "♀ Velle" },
  { value: "TAUREAU", label: "♂ Taureau" },
  { value: "VEAU_M", label: "♂ Veau" },
];

const REPRO_OPTIONS: FilterOption[] = [
  { value: undefined, label: "Tous statuts" },
  { value: "PLEINE", label: "Gestantes" },
  { value: "VIDE", label: "Vides" },
  { value: "A_ECO", label: "À échographier" },
];

// ─── FilterDropdown ───────────────────────────────────────────────────────────

function FilterDropdown({
  label,
  options,
  currentValue,
  paramKey,
  buildFilterUrl,
}: {
  label: string;
  options: FilterOption[];
  currentValue: string | undefined;
  paramKey: string;
  buildFilterUrl: (key: string, value: string | undefined) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isFiltered = !!currentValue;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 whitespace-nowrap hover:text-green-200 transition-colors ${
          isFiltered ? "text-yellow-300" : ""
        }`}
      >
        {label}
        {isFiltered && <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 shrink-0" />}
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white text-gray-800 rounded-lg shadow-xl z-50 min-w-max border border-gray-100 overflow-hidden">
          {options.map((opt) => {
            const active =
              currentValue === opt.value || (!currentValue && opt.value === undefined);
            return (
              <button
                key={opt.label}
                onClick={() => {
                  router.push(buildFilterUrl(paramKey, opt.value));
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-green-50 transition-colors ${
                  active ? "font-semibold text-green-700 bg-green-50" : ""
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SortHeader ──────────────────────────────────────────────────────────────

function SortHeader({
  label,
  buildFilterUrl,
  triAsc,
  triDesc,
  currentTri,
}: {
  label: string;
  buildFilterUrl: (key: string, value: string | undefined) => string;
  triAsc?: string;
  triDesc?: string;
  currentTri: string | undefined;
}) {
  const router = useRouter();
  const isAsc = currentTri === triAsc;
  const isDesc = currentTri === triDesc;
  const isActive = isAsc || isDesc || (!triAsc && !currentTri);

  function handleClick() {
    if (!triAsc) {
      // N° travail sort: reset tri
      router.push(buildFilterUrl("tri", undefined));
      return;
    }
    if (!currentTri || currentTri === triDesc) {
      router.push(buildFilterUrl("tri", triAsc));
    } else {
      router.push(buildFilterUrl("tri", triDesc));
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 hover:text-green-200 transition-colors whitespace-nowrap ${
        isActive ? "text-yellow-300" : ""
      }`}
    >
      {label}
      {triAsc ? (
        <span className="flex flex-col leading-none text-[8px]">
          <span className={isAsc ? "text-yellow-300" : "opacity-60"}>▲</span>
          <span className={isDesc ? "text-yellow-300" : "opacity-60"}>▼</span>
        </span>
      ) : (
        isActive && <span className="text-yellow-300">▲</span>
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TroupeauTableau({ animaux, postCalvingRestDays }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read current filter state
  const currentTri = searchParams.get("tri") ?? undefined;
  const currentCategorie = searchParams.get("categorie") ?? undefined;
  const currentRepro = searchParams.get("repro") ?? undefined;

  function buildFilterUrl(key: string, value: string | undefined): string {
    const params = new URLSearchParams(searchParams.toString());
    if (value !== undefined) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    params.set("vue", "tableau");
    return `/troupeau?${params.toString()}`;
  }

  if (animaux.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12 bg-white rounded-xl shadow">
        Aucun animal trouvé
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-green-700 text-white text-xs select-none">
              <th className="px-3 py-2.5 text-left font-semibold">
                <SortHeader
                  label="N° Travail"
                  buildFilterUrl={buildFilterUrl}
                  currentTri={currentTri}
                />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">Nom</th>
              <th className="px-3 py-2.5 text-left font-semibold">
                <SortHeader
                  label="Âge"
                  buildFilterUrl={buildFilterUrl}
                  triAsc="age_asc"
                  triDesc="age_desc"
                  currentTri={currentTri}
                />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">Dernier poids</th>
              <th className="px-3 py-2.5 text-left font-semibold">
                <FilterDropdown
                  label="Catégorie"
                  options={CATS_OPTIONS}
                  currentValue={currentCategorie}
                  paramKey="categorie"
                  buildFilterUrl={buildFilterUrl}
                />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">
                <FilterDropdown
                  label="Repro"
                  options={REPRO_OPTIONS}
                  currentValue={currentRepro}
                  paramKey="repro"
                  buildFilterUrl={buildFilterUrl}
                />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">Mère</th>
              <th className="px-3 py-2.5 text-left font-semibold">Père</th>
              <th className="px-3 py-2.5 text-left font-semibold">Sevrage</th>
            </tr>
          </thead>
          <tbody>
            {animaux.map((animal, i) => {
              const danais = new Date(animal.danais);
              const catLabel = getCategorieLabel(
                animal.sexbov, danais, animal.estGenisse, animal.categorie
              );
              const cat = getCategorie(
                animal.sexbov, danais, animal.estGenisse, animal.categorie
              );
              const catColor = getCategorieColor(cat);

              const etat: EtatGestation | null =
                ["VACHE", "MOYENNE_GENISSE", "GRANDE_GENISSE", "A_ENGRAISSER"].includes(cat)
                  ? animal.reproductionEtatManuel ?? getEtatGestation(
                      animal.saillieDate ? new Date(animal.saillieDate) : null,
                      animal.gestationEtat ?? null,
                      animal.gestationVelagePrevue
                        ? new Date(animal.gestationVelagePrevue)
                        : null,
                      animal.velageDate ? new Date(animal.velageDate) : null,
                      false,
                      postCalvingRestDays
                    )
                  : null;

              const gestationDays =
                etat === "VERT" && animal.gestationEtat === "VERT" && animal.saillieDate
                  ? differenceInDays(new Date(), new Date(animal.saillieDate))
                  : null;
              const motherWeaning = getMotherWeaningDisplay({
                motherNutrav: animal.mereNutrav,
                sevreFait: animal.sevreFait,
              });
              const father = formatFather(animal.pereNom, animal.pereNumero);

              return (
                <tr
                  key={animal.id}
                  onClick={() => {
                    sessionStorage.setItem("troupeau:scrollY", String(window.scrollY));
                    router.push(`/troupeau/${animal.nutrav}`);
                  }}
                  className={`border-t border-gray-100 cursor-pointer hover:bg-green-50 transition-colors ${
                    i % 2 === 1 ? "bg-gray-50/50" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 font-mono font-bold text-green-800 whitespace-nowrap">
                    {animal.nutrav}
                  </td>
                  <td className="px-3 py-2.5 text-gray-800 max-w-[140px] truncate">
                    {animal.nobovi ?? (
                      <span className="text-gray-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                    {formatAgeCompact(danais)}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                    {animal.dernierPoids !== null ? (
                      <div>
                        <span className="font-semibold">{animal.dernierPoids} kg</span>
                        {animal.dernierePeseeDate && (
                          <div className="text-[10px] text-gray-400">
                            {new Intl.RelativeTimeFormat("fr", { numeric: "auto" }).format(
                              -Math.max(0, Math.round((Date.now() - new Date(animal.dernierePeseeDate).getTime()) / 86400000)),
                              "day"
                            )}
                          </div>
                        )}
                      </div>
                    ) : <span className="text-gray-200">—</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${catColor}`}
                    >
                      {animal.sexbov === "F" ? "♀" : "♂"} {catLabel}
                    </span>
                    {animal.enAttente && (
                      <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700" title="Délai d'attente en cours">
                        ⏱
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {etat ? (
                      <div className="flex flex-wrap gap-1">
                        <ReproductionListBadge
                          etat={etat}
                          fallbackLabel={ETAT_LABEL[etat] ?? etat}
                          gestationDays={gestationDays}
                        />
                        {animal.aEchographier && etat !== "JAUNE" && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full">
                            À écho
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs font-bold text-gray-800">{motherWeaning.motherLabel}</span>
                  </td>
                  <td className="max-w-[9rem] px-3 py-2.5 text-xs font-semibold text-gray-700">
                    <span className="line-clamp-2">{father}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {motherWeaning.statusLabel && <span className="whitespace-nowrap text-[10px] font-semibold text-blue-700">🍼 {motherWeaning.statusLabel}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

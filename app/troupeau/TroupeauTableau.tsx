"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  getCategorie,
  getCategorieLabel,
  getCategorieColor,
  getEtatGestation,
  getBadgeClass,
  formatAgeCompact,
  type EtatGestation,
} from "@/lib/utils";

export interface AnimalRow {
  id: string;
  nutrav: string;
  nobovi: string | null;
  danais: string;
  sexbov: string;
  estGenisse: boolean;
  tarieFaite: boolean;
  aEchographier: boolean;
  categorie: string | null;
  groupeNom: string | null;
  saillieDate: string | null;
  gestationEtat: string | null;
  gestationVelagePrevue: string | null;
  velageDate: string | null;
  veauNutrav: string | null;
  veauStatut: string | null;
  veauSevreFait: boolean | null;
}

interface Props {
  animaux: AnimalRow[];
  groupes: { id: string; nom: string }[];
}

interface FilterOption {
  value: string | undefined;
  label: string;
}

const ETAT_LABEL: Record<string, string> = {
  VERT: "Pleine",
  ROSE: "Imminente",
  JAUNE: "À écho",
  GRIS: "En attente",
  ROUGE: "Vide",
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
  { value: "PLEINE", label: "Pleines" },
  { value: "VIDE", label: "Vides" },
  { value: "A_ECO", label: "À échographier" },
];

const TARIE_OPTIONS: FilterOption[] = [
  { value: undefined, label: "Toutes" },
  { value: "oui", label: "Taries" },
  { value: "non", label: "Non taries" },
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

export default function TroupeauTableau({ animaux, groupes }: Props) {
  const searchParams = useSearchParams();

  // Read current filter state
  const currentTri = searchParams.get("tri") ?? undefined;
  const currentCategorie = searchParams.get("categorie") ?? undefined;
  const currentRepro = searchParams.get("repro") ?? undefined;
  const currentTarie = searchParams.get("tarie") ?? undefined;
  const currentGroupe = searchParams.get("groupe") ?? undefined;

  function buildFilterUrl(key: string, value: string | undefined): string {
    const params = new URLSearchParams(searchParams.toString());
    if (value !== undefined) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    params.set("vue", "tableau");
    return `/troupeau?${params.toString()}`;
  }

  const groupeOptions: FilterOption[] = [
    { value: undefined, label: "Tous groupes" },
    ...groupes.map((g) => ({ value: g.id, label: g.nom })),
  ];

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
        <table className="w-full text-sm min-w-[820px]">
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
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">
                À écho
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">
                <FilterDropdown
                  label="🐮 Allaitante"
                  options={TARIE_OPTIONS}
                  currentValue={currentTarie}
                  paramKey="tarie"
                  buildFilterUrl={buildFilterUrl}
                />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">
                {groupes.length > 0 ? (
                  <FilterDropdown
                    label="Groupe"
                    options={groupeOptions}
                    currentValue={currentGroupe}
                    paramKey="groupe"
                    buildFilterUrl={buildFilterUrl}
                  />
                ) : (
                  "Groupe"
                )}
              </th>
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
                ["VACHE", "MOYENNE_GENISSE", "GRANDE_GENISSE"].includes(cat)
                  ? getEtatGestation(
                      animal.saillieDate ? new Date(animal.saillieDate) : null,
                      animal.gestationEtat ?? null,
                      animal.gestationVelagePrevue
                        ? new Date(animal.gestationVelagePrevue)
                        : null,
                      animal.velageDate ? new Date(animal.velageDate) : null
                    )
                  : null;

              const veauActif =
                animal.veauNutrav && animal.veauStatut === "ACTIF" && !animal.veauSevreFait
                  ? animal.veauNutrav
                  : null;

              return (
                <tr
                  key={animal.id}
                  onClick={() =>
                    (window.location.href = `/troupeau/${animal.nutrav}`)
                  }
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
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${catColor}`}
                    >
                      {animal.sexbov === "F" ? "♀" : "♂"} {catLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {etat ? (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${getBadgeClass(etat)}`}
                      >
                        {ETAT_LABEL[etat] ?? etat}
                      </span>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {animal.aEchographier ? (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">
                        Oui
                      </span>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {veauActif ? (
                      <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                        🐮 {veauActif}
                      </span>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {animal.groupeNom ? (
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {animal.groupeNom}
                      </span>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
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

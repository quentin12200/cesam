"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown, Settings2, X } from "lucide-react";
import { formatAgeCompact, getCategorie, getEtatGestation, type EtatGestation } from "@/lib/utils";
import { formatFather } from "@/lib/troupeau-display";
import {
  DEFAULT_TROUPEAU_MOBILE_TABLE_PREFERENCES,
  parsePersistentAnimalSelection,
  parseTroupeauMobileTablePreferences,
  type TroupeauMobileColumn,
  type TroupeauMobileTablePreferences,
} from "@/lib/troupeau-mobile-table";
import type { AnimalRow } from "./TroupeauTableau";

export const TROUPEAU_MOBILE_TABLE_STORAGE_KEY = "cesam:troupeau-mobile-table:v1";
export const TROUPEAU_SELECTION_STORAGE_KEY = "cesam:troupeau-selection:v1";

const COLUMNS: { key: TroupeauMobileColumn; label: string; compact?: boolean }[] = [
  { key: "numero", label: "Numéro" }, { key: "sexe", label: "Sexe", compact: true },
  { key: "age", label: "Âge", compact: true }, { key: "mother", label: "Mère" },
  { key: "father", label: "Père" }, { key: "group", label: "Lot" },
  { key: "reproduction", label: "Reproduction" }, { key: "dryOff", label: "Tarie" },
];

const REPRODUCTION_LABELS: Record<string, string> = {
  VERT: "Gestante", ROSE: "Imminente", JAUNE: "À écho", GRIS: "En attente", REPOS: "Repos", ROUGE: "Vide",
};

type SortState = { key: TroupeauMobileColumn; direction: "asc" | "desc" };

function reproductionFor(animal: AnimalRow, postCalvingRestDays: number): EtatGestation | null {
  const category = getCategorie(animal.sexbov, new Date(animal.danais), animal.estGenisse, animal.categorie);
  if (!["VACHE", "MOYENNE_GENISSE", "GRANDE_GENISSE", "A_ENGRAISSER"].includes(category)) return null;
  return animal.reproductionEtatManuel ?? getEtatGestation(
    animal.saillieDate ? new Date(animal.saillieDate) : null,
    animal.gestationEtat,
    animal.gestationVelagePrevue ? new Date(animal.gestationVelagePrevue) : null,
    animal.velageDate ? new Date(animal.velageDate) : null,
    false,
    postCalvingRestDays,
  );
}

function displayValue(animal: AnimalRow, column: TroupeauMobileColumn, postCalvingRestDays: number): string {
  if (column === "numero") return animal.nutrav;
  if (column === "sexe") return animal.sexbov === "F" ? "F" : animal.sexbov === "M" ? "M" : "—";
  if (column === "age") return formatAgeCompact(new Date(animal.danais));
  if (column === "mother") return animal.mereNutrav ?? "—";
  if (column === "father") return formatFather(animal.pereNom, animal.pereNumero);
  if (column === "group") return animal.groupeNom ?? "—";
  if (column === "dryOff") return animal.sexbov === "F" && !animal.estGenisse ? (animal.tarieFaite ? "Tarie" : "Non tarie") : "—";
  const reproduction = reproductionFor(animal, postCalvingRestDays);
  if (animal.aEchographier) return reproduction ? `${REPRODUCTION_LABELS[reproduction] ?? reproduction} · À écho` : "À écho";
  return reproduction ? REPRODUCTION_LABELS[reproduction] ?? reproduction : "—";
}

function defaults(): TroupeauMobileTablePreferences {
  return { visible: [...DEFAULT_TROUPEAU_MOBILE_TABLE_PREFERENCES.visible], order: [...DEFAULT_TROUPEAU_MOBILE_TABLE_PREFERENCES.order] };
}

export default function TroupeauMobileList({ animaux, postCalvingRestDays }: { animaux: AnimalRow[]; postCalvingRestDays: number }) {
  const router = useRouter();
  const [preferences, setPreferences] = useState<TroupeauMobileTablePreferences>(defaults);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sort, setSort] = useState<SortState>({ key: "numero", direction: "asc" });

  useEffect(() => {
    setPreferences(parseTroupeauMobileTablePreferences(localStorage.getItem(TROUPEAU_MOBILE_TABLE_STORAGE_KEY)));
    setSelectedIds(new Set(parsePersistentAnimalSelection(localStorage.getItem(TROUPEAU_SELECTION_STORAGE_KEY))));
  }, []);

  const visibleColumns = preferences.order.filter((key) => preferences.visible.includes(key));
  const sortedAnimals = useMemo(() => [...animaux].sort((left, right) => {
    const comparison = sort.key === "age"
      ? new Date(right.danais).getTime() - new Date(left.danais).getTime()
      : displayValue(left, sort.key, postCalvingRestDays).localeCompare(displayValue(right, sort.key, postCalvingRestDays), "fr", { numeric: true, sensitivity: "base" });
    return sort.direction === "asc" ? comparison : -comparison;
  }), [animaux, postCalvingRestDays, sort]);
  const allVisibleSelected = animaux.length > 0 && animaux.every((animal) => selectedIds.has(animal.id));

  function savePreferences(next: TroupeauMobileTablePreferences) {
    setPreferences(next);
    localStorage.setItem(TROUPEAU_MOBILE_TABLE_STORAGE_KEY, JSON.stringify(next));
  }
  function saveSelection(next: Set<string>) {
    setSelectedIds(next);
    localStorage.setItem(TROUPEAU_SELECTION_STORAGE_KEY, JSON.stringify([...next]));
  }
  function toggleSelection(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    saveSelection(next);
  }
  function toggleVisibleSelection() {
    const next = new Set(selectedIds);
    if (allVisibleSelected) animaux.forEach((animal) => next.delete(animal.id));
    else animaux.forEach((animal) => next.add(animal.id));
    saveSelection(next);
  }
  function toggleColumn(key: TroupeauMobileColumn) {
    const visible = preferences.visible.includes(key) ? preferences.visible.filter((item) => item !== key) : [...preferences.visible, key];
    savePreferences({ ...preferences, visible: visible.length ? visible : ["numero"] });
  }
  function moveColumn(key: TroupeauMobileColumn, offset: -1 | 1) {
    const current = preferences.order.indexOf(key);
    const target = current + offset;
    if (current < 0 || target < 0 || target >= preferences.order.length) return;
    const order = [...preferences.order];
    [order[current], order[target]] = [order[target], order[current]];
    savePreferences({ ...preferences, order });
  }
  function toggleSort(key: TroupeauMobileColumn) {
    setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  }

  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={toggleVisibleSelection} className="min-h-10 rounded-lg px-2 text-xs font-semibold text-green-800">
        {allVisibleSelected ? "Tout désélectionner" : "Tout sélectionner"}
      </button>
      <button type="button" onClick={() => setSettingsOpen((open) => !open)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm" aria-expanded={settingsOpen}>
        <Settings2 size={15} /> Colonnes
      </button>
    </div>

    {settingsOpen && <section className="rounded-xl border border-green-100 bg-white p-3 shadow-sm" aria-label="Personnaliser les colonnes">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Colonnes affichées</h3>
        <button type="button" onClick={() => setSettingsOpen(false)} className="grid min-h-9 min-w-9 place-items-center text-gray-500" aria-label="Fermer"><X size={18} /></button>
      </div>
      <div className="space-y-1">{preferences.order.map((key, index) => {
        const column = COLUMNS.find((item) => item.key === key)!;
        return <div key={key} className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-100 px-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={preferences.visible.includes(key)} onChange={() => toggleColumn(key)} className="h-5 w-5 accent-green-700" />{column.label}
          </label>
          <button type="button" disabled={index === 0} onClick={() => moveColumn(key, -1)} className="grid h-9 w-9 place-items-center disabled:opacity-25" aria-label={`Monter ${column.label}`}><ArrowUp size={16} /></button>
          <button type="button" disabled={index === preferences.order.length - 1} onClick={() => moveColumn(key, 1)} className="grid h-9 w-9 place-items-center disabled:opacity-25" aria-label={`Descendre ${column.label}`}><ArrowDown size={16} /></button>
        </div>;
      })}</div>
      <button type="button" onClick={() => savePreferences(defaults())} className="mt-2 min-h-9 text-xs font-semibold text-green-700">Réinitialiser</button>
    </section>}

    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-gray-600"><tr>
          <th className="w-11 px-2 py-2"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} className="h-5 w-5 accent-green-700" aria-label="Sélectionner les animaux visibles" /></th>
          {visibleColumns.map((key) => {
            const column = COLUMNS.find((item) => item.key === key)!;
            return <th key={key} className={`whitespace-nowrap px-2 py-2 font-semibold ${column.compact ? "w-16" : "min-w-24"}`}>
              <button type="button" onClick={() => toggleSort(key)} className="inline-flex min-h-8 items-center gap-1" aria-label={`Trier par ${column.label}`}>
                {column.label}<ChevronsUpDown size={13} className={sort.key === key ? "text-green-700" : "text-gray-300"} />
              </button>
            </th>;
          })}
        </tr></thead>
        <tbody>{sortedAnimals.map((animal) => <tr key={animal.id} onClick={() => router.push(`/troupeau/${animal.nutrav}`)} className="cursor-pointer border-t border-gray-100 active:bg-green-50">
          <td className="px-2 py-2.5" onClick={(event) => event.stopPropagation()}>
            <input type="checkbox" checked={selectedIds.has(animal.id)} onChange={() => toggleSelection(animal.id)} className="h-5 w-5 accent-green-700" aria-label={`Sélectionner ${animal.nutrav}`} />
          </td>
          {visibleColumns.map((key) => <td key={key} className={`max-w-44 whitespace-nowrap px-2 py-2.5 ${key === "numero" ? "font-mono text-base font-black text-gray-950" : "text-gray-700"}`}>
            <span className="block max-w-40 truncate">{displayValue(animal, key, postCalvingRestDays)}</span>
          </td>)}
        </tr>)}</tbody>
      </table>
      {animaux.length === 0 && <div className="py-12 text-center text-sm text-gray-500">Aucun animal trouvé</div>}
    </div>

    {selectedIds.size > 0 && <div className="sticky bottom-3 z-20 flex min-h-12 items-center justify-between rounded-xl bg-gray-950 px-4 text-white shadow-xl">
      <span className="text-sm font-bold">{selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}</span>
      <button type="button" onClick={() => saveSelection(new Set())} className="min-h-10 px-2 text-sm font-semibold text-white underline">Vider</button>
    </div>}
  </div>;
}

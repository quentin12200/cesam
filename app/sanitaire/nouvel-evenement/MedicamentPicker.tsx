"use client";

import { useId, useMemo, useState } from "react";
import { Search, X, Pencil } from "lucide-react";
import { searchTypesEvenement } from "@/lib/fuzzy-search";
import { getCategorieMedicament } from "@/lib/medicament-categories";

export interface PreconisationOption {
  id: string;
  indicationMotif: string | null;
  dose: number | null;
  unite: string | null;
  doseBase: string | null;
  voie: string | null;
  frequence: string | null;
  dureeValeur: number | null;
  dureeUnite: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitTraites: number | null;
  statut: string;
}

export interface MedicamentOption {
  id: string;
  nom: string;
  dci: string | null;
  categorie: string;
  voie: string | null;
  dosagePourKg: number | null;
  uniteDosage: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  preconisations: PreconisationOption[];
}

interface Props {
  medicaments: MedicamentOption[];
  value: MedicamentOption | null;
  onChange: (m: MedicamentOption | null) => void;
  allowFreeText?: boolean;
  freeText?: string;
  onFreeTextChange?: (value: string) => void;
}

export default function MedicamentPicker({
  medicaments,
  value,
  onChange,
  allowFreeText = false,
  freeText = "",
  onFreeTextChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const listeId = useId();

  const resultats = useMemo(() => {
    if (!query.trim()) return [];
    const recherchables = medicaments.map((medicament) => ({
      ...medicament,
      synonymes: medicament.dci,
    }));
    return searchTypesEvenement(query, recherchables)
      .slice(0, 8)
      .map((resultat) => resultat.item);
  }, [query, medicaments]);

  function recommencer() {
    onChange(null);
    onFreeTextChange?.("");
    setQuery("");
    setOuvert(true);
  }

  if (value) {
    const cat = getCategorieMedicament(value.categorie);
    return (
      <div className="flex items-center justify-between gap-2 bg-white border border-blue-300 rounded-lg px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-gray-800">{value.nom}</span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: cat.bg, color: cat.text }}
            >
              {cat.label}
            </span>
          </div>
          {value.dci && <div className="text-xs text-gray-500 mt-0.5">{value.dci}</div>}
        </div>
        <button
          type="button"
          onClick={recommencer}
          title="Changer de médicament"
          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
        >
          <Pencil size={13} />
        </button>
      </div>
    );
  }

  if (freeText) {
    return (
      <div className="flex items-center justify-between gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
        <div>
          <div className="text-[10px] font-medium text-gray-400 uppercase">Saisie libre</div>
          <div className="text-sm font-semibold text-gray-800">{freeText}</div>
        </div>
        <button
          type="button"
          onClick={recommencer}
          title="Modifier le médicament"
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
        >
          <Pencil size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <Search size={15} className="text-gray-400 mr-2 shrink-0" />
        <input
          value={query}
          onFocus={() => setOuvert(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOuvert(true);
          }}
          placeholder="Tapez le nom ou la substance active…"
          role="combobox"
          aria-expanded={ouvert && Boolean(query.trim())}
          aria-controls={listeId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          className="w-full text-sm outline-none bg-transparent"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            title="Effacer la recherche"
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {ouvert && query.trim() && (
        <div
          id={listeId}
          role="listbox"
          className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-20 max-h-64 overflow-y-auto"
        >
          {resultats.map((medicament) => {
            const cat = getCategorieMedicament(medicament.categorie);
            return (
              <button
                key={medicament.id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onChange(medicament);
                  onFreeTextChange?.("");
                  setQuery("");
                  setOuvert(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800">{medicament.nom}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: cat.bg, color: cat.text }}
                  >
                    {cat.label}
                  </span>
                </div>
                {medicament.dci && (
                  <div className="text-xs text-gray-500 mt-0.5">Substance active : {medicament.dci}</div>
                )}
              </button>
            );
          })}

          {resultats.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              Aucun médicament trouvé dans la pharmacie.
            </div>
          )}

          {allowFreeText && (
            <button
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onChange(null);
                onFreeTextChange?.(query.trim());
                setQuery("");
                setOuvert(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-blue-700 hover:bg-blue-50 border-t border-blue-100"
            >
              Utiliser « {query.trim()} » en saisie libre
            </button>
          )}
        </div>
      )}
    </div>
  );
}

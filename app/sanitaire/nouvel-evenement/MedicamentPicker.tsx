"use client";

import { useMemo, useState } from "react";
import { Search, X, Pencil } from "lucide-react";
import { normalizeSearch } from "@/lib/fuzzy-search";
import { getCategorieMedicament } from "@/lib/medicament-categories";

export interface MedicamentOption {
  id: string;
  nom: string;
  dci: string | null;
  categorie: string;
  voie: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
}

interface Props {
  medicaments: MedicamentOption[];
  value: MedicamentOption | null;
  onChange: (m: MedicamentOption | null) => void;
}

export default function MedicamentPicker({ medicaments, value, onChange }: Props) {
  const [query, setQuery] = useState("");

  const resultats = useMemo(() => {
    const q = normalizeSearch(query.trim());
    if (!q) return [];
    return medicaments
      .filter((m) => normalizeSearch(`${m.nom} ${m.dci ?? ""}`).includes(q))
      .slice(0, 8);
  }, [query, medicaments]);

  if (value) {
    const cat = getCategorieMedicament(value.categorie);
    return (
      <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-gray-800">{value.nom}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: cat.bg, color: cat.text }}>
              {cat.label}
            </span>
          </div>
          {value.dci && <div className="text-xs text-gray-500 mt-0.5">{value.dci}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => onChange(null)} title="Changer de médicament"
            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded">
            <Pencil size={13} />
          </button>
          <button type="button" onClick={() => onChange(null)} title="Retirer"
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2">
        <Search size={15} className="text-gray-400 mr-2 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un médicament dans la pharmacie…"
          className="w-full text-sm outline-none"
        />
      </div>
      {query.trim() && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-10 max-h-64 overflow-y-auto">
          {resultats.map((m) => {
            const cat = getCategorieMedicament(m.categorie);
            return (
              <button key={m.id} type="button" onClick={() => { onChange(m); setQuery(""); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 flex-wrap">
                <span className="font-medium">{m.nom}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: cat.bg, color: cat.text }}>
                  {cat.label}
                </span>
                {m.dci && <span className="text-xs text-gray-400">{m.dci}</span>}
              </button>
            );
          })}
          {resultats.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">Aucun médicament trouvé pour « {query} »</div>
          )}
        </div>
      )}
    </div>
  );
}

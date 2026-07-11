"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search } from "lucide-react";

export interface AnimalOption {
  id: string;
  nutrav: string;
  nom: string | null;
}

interface Props {
  selected: AnimalOption[];
  onChange: (animaux: AnimalOption[]) => void;
  multiple: boolean;
}

export default function AnimalPicker({ selected, onChange, multiple }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimalOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 1) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults(data.map((a: { id: string; nutrav: string; nom: string | null }) => ({ id: a.id, nutrav: a.nutrav, nom: a.nom })));
      setShowDropdown(true);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function pick(a: AnimalOption) {
    if (selected.some((s) => s.id === a.id)) { setQuery(""); setShowDropdown(false); return; }
    onChange(multiple ? [...selected, a] : [a]);
    setQuery("");
    setShowDropdown(false);
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s.id !== id));
  }

  return (
    <div>
      <div className="relative">
        <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-400">
          <Search size={15} className="text-gray-400 mr-2 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder={multiple ? "Ajouter un animal (n° travail ou nom)…" : "N° travail ou nom de l'animal…"}
            className="w-full text-sm outline-none"
          />
        </div>
        {showDropdown && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-10 max-h-56 overflow-y-auto">
            {results.map((a) => (
              <button
                key={a.id}
                type="button"
                onMouseDown={() => pick(a)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
              >
                <span>{a.nutrav}{a.nom ? ` — ${a.nom}` : ""}</span>
                {selected.some((s) => s.id === a.id) && <span className="text-xs text-blue-600">déjà ajouté</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((a) => (
            <span key={a.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full pl-2.5 pr-1 py-1 text-xs">
              {a.nutrav}{a.nom ? ` — ${a.nom}` : ""}
              <button type="button" onClick={() => remove(a.id)} className="hover:bg-blue-100 rounded-full p-0.5">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

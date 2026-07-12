"use client";

import { useState, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import type { AnimalOption } from "./AnimalPicker";

interface Candidat {
  id: string;
  nutrav: string;
  nom: string | null;
}

interface Props {
  selected: AnimalOption[];
  onChange: (animaux: AnimalOption[]) => void;
}

export default function AnimalMultiEntry({ selected, onChange }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function ajouter(a: Candidat) {
    if (selected.some((s) => s.id === a.id)) {
      setError(`${a.nutrav} est déjà dans la sélection`);
      setInputValue("");
      setCandidats([]);
      return;
    }
    onChange([...selected, { id: a.id, nutrav: a.nutrav, nom: a.nom }]);
    setInputValue("");
    setCandidats([]);
    setError("");
    inputRef.current?.focus();
  }

  async function valider() {
    const q = inputValue.trim().replace(/\s+/g, " ");
    if (!q) return;
    setChecking(true);
    setError("");
    setCandidats([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data: Candidat[] = await res.json();
      if (data.length === 0) {
        setError(`Aucun animal ne correspond à "${q}"`);
        setInputValue("");
        return;
      }
      const exact = data.find((a) => a.nutrav.toLowerCase() === q.toLowerCase());
      if (exact) { ajouter(exact); return; }
      if (data.length === 1) { ajouter(data[0]); return; }
      setCandidats(data);
    } catch {
      setError("Erreur de recherche, réessaie");
    } finally {
      setChecking(false);
    }
  }

  function retirer(id: string) {
    onChange(selected.filter((s) => s.id !== id));
  }

  return (
    <div>
      <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-400">
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); valider(); } }}
          placeholder="N° travail, nom ou n° national — Entrée pour ajouter"
          className="w-full text-sm outline-none"
        />
        {checking && <Loader2 size={14} className="animate-spin text-gray-400 shrink-0" />}
      </div>

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {candidats.length > 0 && (
        <div className="mt-1.5 border rounded-lg overflow-hidden">
          <p className="text-xs text-gray-400 px-3 pt-2">Plusieurs correspondances — choisis :</p>
          {candidats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => ajouter(c)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
            >
              <span>{c.nutrav}{c.nom ? ` — ${c.nom}` : ""}</span>
            </button>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((a) => (
            <span key={a.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full pl-2.5 pr-1 py-1 text-xs">
              {a.nutrav}{a.nom ? ` — ${a.nom}` : ""}
              <button type="button" onClick={() => retirer(a.id)} className="hover:bg-blue-100 rounded-full p-0.5">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

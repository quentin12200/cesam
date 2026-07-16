"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Check } from "lucide-react";
import { getCategorie, getCategorieLabel, getCategorieColor, CATEGORIES_LABELS, type CategorieAnimal } from "@/lib/utils";
import SelectionModal from "@/components/SelectionModal";
import type { AnimalOption } from "./AnimalPicker";

interface AnimalPickerRow {
  id: string;
  nutrav: string;
  nobovi: string | null;
  nunati: string;
  danais: string;
  sexbov: string;
  estGenisse: boolean;
  categorie: string | null;
  groupeId: string | null;
  groupeNom: string | null;
}

interface Groupe {
  id: string;
  nom: string;
}

interface Props {
  selected: AnimalOption[];
  onChange: (animaux: AnimalOption[]) => void;
  onClose: () => void;
  groupes: Groupe[];
  sexeImpose?: "F" | "M";
  multiple?: boolean;
}

export default function AnimalPickerModal({ selected, onChange, onClose, groupes, sexeImpose, multiple = true }: Props) {
  const [animaux, setAnimaux] = useState<AnimalPickerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtreGroupe, setFiltreGroupe] = useState("");
  const [filtreSexe, setFiltreSexe] = useState<"" | "F" | "M">("");
  const [filtreCategorie, setFiltreCategorie] = useState<"" | CategorieAnimal>("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set((multiple ? selected : selected.slice(0, 1)).map((a) => a.id)));
  const [meta, setMeta] = useState<Map<string, AnimalOption>>(new Map(selected.map((a) => [a.id, a])));

  useEffect(() => {
    fetch("/api/animaux/picker")
      .then((r) => r.json())
      .then((data: AnimalPickerRow[]) => {
        setAnimaux(data);
        setMeta((prev) => {
          const next = new Map(prev);
          for (const a of data) {
            if (!next.has(a.id)) next.set(a.id, { id: a.id, nutrav: a.nutrav, nom: a.nobovi });
          }
          return next;
        });
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return animaux.filter((a) => {
      if (q && !(a.nutrav.toLowerCase().includes(q) || (a.nobovi ?? "").toLowerCase().includes(q) || a.nunati.toLowerCase().includes(q))) return false;
      if (filtreGroupe && a.groupeId !== filtreGroupe) return false;
      if (sexeImpose && a.sexbov !== sexeImpose) return false;
      if (!sexeImpose && filtreSexe && a.sexbov !== filtreSexe) return false;
      if (filtreCategorie && getCategorie(a.sexbov, new Date(a.danais), a.estGenisse, a.categorie) !== filtreCategorie) return false;
      return true;
    });
  }, [animaux, query, filtreGroupe, filtreSexe, filtreCategorie, sexeImpose]);

  function toggle(a: AnimalPickerRow) {
    setSelectedIds((prev) => {
      if (!multiple) return prev.has(a.id) ? new Set() : new Set([a.id]);
      const next = new Set(prev);
      if (next.has(a.id)) next.delete(a.id);
      else next.add(a.id);
      return next;
    });
    setMeta((prev) => {
      if (prev.has(a.id)) return prev;
      const next = new Map(prev);
      next.set(a.id, { id: a.id, nutrav: a.nutrav, nom: a.nobovi });
      return next;
    });
  }

  function toutSelectionner() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const a of filtered) next.add(a.id);
      return next;
    });
    setMeta((prev) => {
      const next = new Map(prev);
      for (const a of filtered) if (!next.has(a.id)) next.set(a.id, { id: a.id, nutrav: a.nutrav, nom: a.nobovi });
      return next;
    });
  }

  function toutDeselectionner() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const a of filtered) next.delete(a.id);
      return next;
    });
  }

  function valider() {
    const result = [...selectedIds].map((id) => meta.get(id)).filter((a): a is AnimalOption => !!a);
    onChange(multiple ? result : result.slice(0, 1));
    onClose();
  }

  return (
    <SelectionModal
      title="Choisir dans le troupeau"
      onClose={onClose}
      controls={(
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2">
            <Search size={15} className="text-gray-400 mr-2 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="N° travail, nom ou n° national…"
              className="w-full text-sm outline-none"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={filtreGroupe} onChange={(e) => setFiltreGroupe(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white">
              <option value="">Tous les lots</option>
              {groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
            </select>
            {sexeImpose ? (
              <span className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 text-gray-600">
                {sexeImpose === "F" ? "Femelles" : "Mâles"}
              </span>
            ) : (
              <select value={filtreSexe} onChange={(e) => setFiltreSexe(e.target.value as "" | "F" | "M")}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white">
                <option value="">Tous sexes</option>
                <option value="F">Femelle</option>
                <option value="M">Mâle</option>
              </select>
            )}
            <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value as "" | CategorieAnimal)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white">
              <option value="">Toutes catégories</option>
              {Object.entries(CATEGORIES_LABELS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{filtered.length} affiché{filtered.length > 1 ? "s" : ""}</span>
            {multiple && (
              <div className="flex gap-3">
                <button type="button" onClick={toutSelectionner} className="text-blue-600 hover:underline">Tout sélectionner</button>
                <button type="button" onClick={toutDeselectionner} className="text-gray-500 hover:underline">Tout désélectionner</button>
              </div>
            )}
          </div>
        </div>
      )}
      footer={(
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-gray-600">
            {selectedIds.size} animal{selectedIds.size > 1 ? "aux" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={valider}
            disabled={selectedIds.size === 0}
            className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            Valider ({selectedIds.size})
          </button>
        </div>
      )}
    >
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Aucun animal trouvé</div>
          ) : (
            filtered.map((a) => {
              const isSel = selectedIds.has(a.id);
              const cat = getCategorie(a.sexbov, new Date(a.danais), a.estGenisse, a.categorie);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 text-left hover:bg-gray-50 ${isSel ? "bg-blue-50" : ""}`}
                >
                  <span className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center ${isSel ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                    {isSel && <Check size={13} className="text-white" />}
                  </span>
                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{a.nutrav}</span>
                  <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{a.nobovi ?? <span className="text-gray-400 italic">Sans nom</span>}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${getCategorieColor(cat)}`}>
                    {a.sexbov === "F" ? "♀" : "♂"} {getCategorieLabel(a.sexbov, new Date(a.danais), a.estGenisse, a.categorie)}
                  </span>
                  {a.groupeNom && <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">{a.groupeNom}</span>}
                </button>
              );
            })
          )}
    </SelectionModal>
  );
}

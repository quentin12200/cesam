"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

export const VIEW_KEY = "cesam:vaccins:view:v1";
export const DRAFT_KEY = "cesam:vaccins:draft:v1";
const viewFields = ["vue", "recherche", "vaccinsAffiches", "statuts", "tri", "directionTri", "colonnesMasquees", "anneesAffichees", "toutHistorique", "uniquementSelection"] as const;
const draftFields = ["animauxSelectionnes", "actesSelectionnes", "dateSession", "executant", "ajustements"] as const;
type Workspace = {
  vue: "TABLEAU" | "AGENDA"; recherche: string; vaccinsAffiches: Set<string>;
  statuts: Set<"aFaire" | "enRetard" | "faits">;
  tri: "numero" | "age" | "sexe" | "velage" | `vaccin:${string}` | null;
  directionTri: "asc" | "desc" | null;
  colonnesMasquees: Set<"numero" | "nom" | "mere" | "age" | "sexe" | "velage">;
  anneesAffichees: Set<number>; toutHistorique: boolean; uniquementSelection: boolean;
  animauxSelectionnes: Set<string>; actesSelectionnes: Set<string>;
  dateSession: string; executant: string;
  ajustements: Record<string, { voie: string; dose: string; uniteDosage: string }>;
};
type Setters = { [K in keyof Workspace as `set${Capitalize<K>}`]: Dispatch<SetStateAction<Workspace[K]>> };
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const strings = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))] : [];
function read(key: string): Record<string, unknown> | null {
  try { const v = JSON.parse(localStorage.getItem(key) ?? "null"); return v && typeof v === "object" && !Array.isArray(v) && v.version === 1 ? v : null; }
  catch { return null; }
}
export function useVaccinWorkspace(state: Workspace, setters: Setters, lignes: { animalId: string; cellules: Record<string, unknown> }[], blocs: { cle: string; sousColonnes: { id: string }[] }[]) {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const loaded = useRef(false);
  const hadSelection = useRef(false);
  const current = useRef({ state, setters });
  current.current = { state, setters };
  const previousGrid = useRef({ lignes, blocs });

  useEffect(() => {
    const gridChanged = previousGrid.current.lignes !== lignes || previousGrid.current.blocs !== blocs;
    if (loaded.current && !gridChanged) return;
    previousGrid.current = { lignes, blocs };
    const { state: s, setters: set } = current.current;
    const animals = new Set(lignes.map((l) => l.animalId));
    const steps = new Set(blocs.flatMap((b) => b.sousColonnes.map((e) => e.id)));
    const availableActs = new Set(lignes.flatMap((l) => Object.keys(l.cellules).filter((e) => steps.has(e)).map((e) => `${l.animalId}|${e}`)));
    const validAct = (key: string) => availableActs.has(key);
    try {
      const view = !loaded.current ? read(VIEW_KEY) : null;
      if (view) {
        if (view.vue === "TABLEAU" || view.vue === "AGENDA") set.setVue(view.vue);
        if (typeof view.recherche === "string") set.setRecherche(view.recherche);
        if (Array.isArray(view.vaccinsAffiches)) set.setVaccinsAffiches(new Set(strings(view.vaccinsAffiches).filter((id) => blocs.some((b) => b.cle === id))));
        set.setStatuts(new Set(strings(view.statuts).filter((v): v is "aFaire" | "enRetard" | "faits" => ["aFaire", "enRetard", "faits"].includes(v))));
        const tri = view.tri;
        if (typeof tri === "string" && (["numero", "age", "sexe", "velage"].includes(tri) || blocs.some((b) => tri === `vaccin:${b.cle}`))) set.setTri(tri as Workspace["tri"]);
        if (view.directionTri === "asc" || view.directionTri === "desc") set.setDirectionTri(view.directionTri);
        set.setColonnesMasquees(new Set(strings(view.colonnesMasquees).filter((v): v is Workspace["colonnesMasquees"] extends Set<infer T> ? T : never => ["numero", "nom", "mere", "age", "sexe", "velage"].includes(v))));
        if (Array.isArray(view.anneesAffichees)) set.setAnneesAffichees(new Set(view.anneesAffichees.filter((v): v is number => Number.isInteger(v))));
        set.setToutHistorique(view.toutHistorique === true);
        set.setUniquementSelection(view.uniquementSelection === true);
      }
      const draft = loaded.current ? { animauxSelectionnes: [...s.animauxSelectionnes], actesSelectionnes: [...s.actesSelectionnes] } : read(DRAFT_KEY);
      if (draft) {
        const beforeAnimals = strings(draft.animauxSelectionnes), beforeActs = strings(draft.actesSelectionnes);
        const selectedAnimals = beforeAnimals.filter((id) => animals.has(id)), selectedActs = beforeActs.filter(validAct);
        set.setAnimauxSelectionnes(new Set(selectedAnimals)); set.setActesSelectionnes(new Set(selectedActs));
        hadSelection.current = selectedAnimals.length + selectedActs.length > 0;
        const lost = beforeAnimals.length + beforeActs.length - selectedAnimals.length - selectedActs.length;
        if (lost) setMessage(`${lost} sélection${lost > 1 ? "s" : ""} du brouillon ${lost > 1 ? "ne sont plus disponibles" : "n’est plus disponible"} après la modification du protocole ou de la grille.`);
        if (typeof draft.dateSession === "string" && /^\d{4}-\d{2}-\d{2}$/.test(draft.dateSession)) set.setDateSession(draft.dateSession);
        if (typeof draft.executant === "string") set.setExecutant(draft.executant);
        if (draft.ajustements && typeof draft.ajustements === "object" && !Array.isArray(draft.ajustements)) {
          set.setAjustements(Object.fromEntries(Object.entries(draft.ajustements).filter(([, v]) => v && typeof v === "object" && typeof v.voie === "string" && typeof v.dose === "string" && typeof v.uniteDosage === "string")));
        }
      }
    } catch { setMessage("Stockage local indisponible : le brouillon ne peut pas être conservé sur cet appareil."); }
    loaded.current = true; setReady(true);
  }, [lignes, blocs]);

  useEffect(() => {
    if (!ready) return;
    const serialize = (fields: readonly (keyof Workspace)[]) => JSON.stringify(Object.fromEntries([["version", 1], ...fields.map((k) => [k, state[k] instanceof Set ? [...state[k]] : state[k]])]));
    try {
      localStorage.setItem(VIEW_KEY, serialize(viewFields));
      const selected = state.animauxSelectionnes.size + state.actesSelectionnes.size > 0;
      if (!selected && hadSelection.current) {
        localStorage.removeItem(DRAFT_KEY);
        setters.setAjustements({}); setters.setDateSession(today()); setters.setExecutant("");
      } else if (selected || state.executant || state.dateSession !== today() || Object.keys(state.ajustements).length) localStorage.setItem(DRAFT_KEY, serialize(draftFields));
      hadSelection.current = selected;
    } catch { setMessage("Stockage local indisponible : le brouillon ne peut pas être conservé sur cet appareil."); }
  }, [ready, state, setters]);

  function vider() {
    const set = current.current.setters;
    set.setAnimauxSelectionnes(new Set()); set.setActesSelectionnes(new Set());
    set.setAjustements({}); set.setDateSession(today()); set.setExecutant(""); set.setUniquementSelection(false);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* The successful save still clears the in-memory draft. */ }
  }
  return { message, vider };
}

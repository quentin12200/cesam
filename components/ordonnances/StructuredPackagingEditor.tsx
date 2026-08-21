"use client";

import { useEffect, useMemo, useState } from "react";
import {
  apercuConditionnement,
  conditionnementCanonique,
  FORMES_CONDITIONNEMENT,
  resoudreConditionnementStructure,
  UNITES_CONDITIONNEMENT,
  type ConditionnementStructure,
} from "@/lib/ordonnance-packaging";

const STORAGE_KEY = "cesam-ordonnance-formes-conditionnement";

function labelForme(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function lireFormesPersonnalisees(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export default function StructuredPackagingEditor({
  value,
  presentation,
  sourceTexts = [],
  onChange,
}: {
  value: string;
  presentation?: Record<string, unknown> | null;
  sourceTexts?: string[];
  onChange: (conditionnement: string, structure: ConditionnementStructure) => void;
}) {
  const initial = useMemo(() => resoudreConditionnementStructure({
    conditionnement: value,
    presentation,
    sourceTexts,
  }), [presentation, sourceTexts, value]);
  const [structure, setStructure] = useState(initial);
  const [formesPersonnalisees, setFormesPersonnalisees] = useState<string[]>([]);
  const [ajoutForme, setAjoutForme] = useState(false);
  const [nouvelleForme, setNouvelleForme] = useState("");
  const [uniteAutre, setUniteAutre] = useState(
    initial.contentUnit && !UNITES_CONDITIONNEMENT.includes(initial.contentUnit as typeof UNITES_CONDITIONNEMENT[number])
      ? initial.contentUnit : "",
  );

  useEffect(() => setFormesPersonnalisees(lireFormesPersonnalisees()), []);

  function modifier(patch: Partial<ConditionnementStructure>, formeConfirmee = false) {
    const suivante = {
      ...structure,
      ...patch,
      needsVerification: formeConfirmee ? false : structure.needsVerification,
      rawContainerType: formeConfirmee ? null : structure.rawContainerType,
    };
    setStructure(suivante);
    onChange(conditionnementCanonique(suivante) ?? "", suivante);
  }

  function memoriserForme() {
    const forme = nouvelleForme.trim().replace(/\s+/g, " ").toLowerCase();
    if (!forme) return;
    const suivantes = Array.from(new Set([...formesPersonnalisees, forme]));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(suivantes));
    setFormesPersonnalisees(suivantes);
    setNouvelleForme("");
    setAjoutForme(false);
    modifier({ containerType: forme }, true);
  }

  const apercu = apercuConditionnement(structure);
  const valeurForme = structure.containerType && structure.containerType !== "autre"
    ? structure.containerType : "autre";
  const uniteConnue = structure.contentUnit
    && UNITES_CONDITIONNEMENT.includes(structure.contentUnit as typeof UNITES_CONDITIONNEMENT[number])
    ? structure.contentUnit : "autre";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5">
      <p className="mb-2 text-[11px] font-semibold text-gray-600">Conditionnement / quantité délivrée</p>
      <div className="grid grid-cols-[minmax(52px,0.55fr)_auto_minmax(105px,1.2fr)] gap-1.5 sm:grid-cols-[72px_auto_minmax(130px,1.1fr)_90px_100px] sm:items-end">
        <label className="min-w-0 text-[10px] text-gray-500">Quantité
          <input type="number" min="0" step="1" value={structure.deliveredQuantity ?? ""}
            onChange={(event) => modifier({ deliveredQuantity: event.target.value ? Number(event.target.value) : null })}
            className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-gray-300 px-2 text-sm" />
        </label>
        <span className="pb-2 text-sm font-semibold text-gray-500">×</span>
        <label className="min-w-0 text-[10px] text-gray-500">Forme
          <select value={valeurForme} onChange={(event) => {
            if (event.target.value === "__ADD__") setAjoutForme(true);
            else modifier({ containerType: event.target.value }, true);
          }} className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2 text-sm">
            {FORMES_CONDITIONNEMENT.map((forme) => <option key={forme} value={forme}>{labelForme(forme)}</option>)}
            {formesPersonnalisees.map((forme) => <option key={forme} value={forme}>{labelForme(forme)}</option>)}
            <option value="autre">Autre</option>
            <option value="__ADD__">+ Ajouter une forme</option>
          </select>
        </label>
        <label className="min-w-0 text-[10px] text-gray-500">Contenu
          <input type="number" min="0" step="0.01" value={structure.contentValue ?? ""}
            onChange={(event) => modifier({ contentValue: event.target.value ? Number(event.target.value) : null })}
            className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-gray-300 px-2 text-sm" />
        </label>
        <label className="min-w-0 text-[10px] text-gray-500">Unité
          <select value={uniteConnue} onChange={(event) => {
            const next = event.target.value;
            if (next !== "autre") {
              setUniteAutre("");
              modifier({ contentUnit: next });
            } else modifier({ contentUnit: uniteAutre || null });
          }} className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2 text-sm">
            {UNITES_CONDITIONNEMENT.map((unite) => <option key={unite} value={unite}>{unite === "ml" ? "mL" : unite === "dose" ? "dose(s)" : unite}</option>)}
            <option value="autre">Autre</option>
          </select>
        </label>
      </div>

      {uniteConnue === "autre" && (
        <label className="mt-2 block text-[10px] text-gray-500">Unité personnalisée
          <input value={uniteAutre} onChange={(event) => { setUniteAutre(event.target.value); modifier({ contentUnit: event.target.value || null }); }}
            className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 px-2 text-sm" />
        </label>
      )}

      <label className="mt-2 block max-w-48 text-[10px] text-gray-500">Doses / contenant
        <input type="number" min="0" step="1" value={structure.dosesPerContainer ?? ""}
          onChange={(event) => modifier({ dosesPerContainer: event.target.value ? Number(event.target.value) : null })}
          className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 px-2 text-sm" />
      </label>

      {ajoutForme && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg bg-gray-50 p-2 sm:flex-row">
          <input value={nouvelleForme} onChange={(event) => setNouvelleForme(event.target.value)} placeholder="Nom de la forme"
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-gray-300 px-2 text-sm" />
          <button type="button" onClick={memoriserForme} className="min-h-10 rounded-lg bg-green-700 px-3 text-xs font-semibold text-white">Ajouter</button>
          <button type="button" onClick={() => setAjoutForme(false)} className="min-h-10 rounded-lg border border-gray-300 px-3 text-xs">Annuler</button>
        </div>
      )}

      {structure.needsVerification && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
          Forme « {structure.rawContainerType ?? "inconnue"} » à vérifier — choisissez une forme avant validation.
        </p>
      )}
      {value && !structure.containerType && (
        <p className="mt-2 text-[11px] text-gray-500">Texte historique : {value}</p>
      )}
      {apercu.ligne && <p className="mt-2 text-xs font-semibold text-gray-800">Aperçu : {apercu.ligne}</p>}
      {apercu.totalDoses && <p className="text-[11px] text-gray-500">{apercu.totalDoses}</p>}
    </div>
  );
}

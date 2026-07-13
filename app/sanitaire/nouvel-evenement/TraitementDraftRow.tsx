"use client";

import { X } from "lucide-react";
import { VOIES_ADMINISTRATION } from "@/lib/medicament-categories";
import MedicamentPicker, { type MedicamentOption } from "./MedicamentPicker";
import ExecutantSelect, { type Intervenant } from "./ExecutantSelect";

export interface TraitementDraft {
  key: string;
  medicament: MedicamentOption | null;
  voie: string;
  executant: string;
  dose: string;
  uniteDosage: string;
  motif: string;
}

interface Props {
  draft: TraitementDraft;
  medicaments: MedicamentOption[];
  intervenants: Intervenant[];
  onChange: (draft: TraitementDraft) => void;
  onRemove: () => void;
  onIntervenantAdded: (i: Intervenant) => void;
  removable: boolean;
}

export default function TraitementDraftRow({ draft, medicaments, intervenants, onChange, onRemove, onIntervenantAdded, removable }: Props) {
  function set<K extends keyof TraitementDraft>(field: K, value: TraitementDraft[K]) {
    onChange({ ...draft, [field]: value });
  }

  function choisirMedicament(m: MedicamentOption | null) {
    if (!m) {
      onChange({ ...draft, medicament: null });
      return;
    }

    const rang: Record<string, number> = { VALIDE: 0, A_VERIFIER: 1, IMPORTE: 2 };
    const preconisation = [...(m.preconisations ?? [])]
      .sort((a, b) => (rang[a.statut] ?? 9) - (rang[b.statut] ?? 9))[0];

    const voieProposee = preconisation?.voie ?? m.voie ?? "";
    const voieNormalisee = VOIES_ADMINISTRATION.find(
      (voie) => voie.code === voieProposee.toUpperCase()
    )?.code ?? voieProposee;

    onChange({
      ...draft,
      medicament: m,
      voie: voieNormalisee || draft.voie,
      dose:
        preconisation?.dose != null
          ? String(preconisation.dose)
          : m.dosagePourKg != null
            ? String(m.dosagePourKg)
            : draft.dose,
      uniteDosage: preconisation?.unite ?? m.uniteDosage ?? draft.uniteDosage,
      motif: preconisation?.indicationMotif ?? draft.motif,
    });
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2.5 bg-gray-50/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <label className="text-xs text-gray-500 block mb-1">Médicament *</label>
          <MedicamentPicker medicaments={medicaments} value={draft.medicament} onChange={choisirMedicament} />
        </div>
        {removable && (
          <button type="button" onClick={onRemove} className="mt-5 shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
            <X size={15} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Voie d&apos;administration *</label>
          <select value={draft.voie} onChange={(e) => set("voie", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Sélectionner…</option>
            {VOIES_ADMINISTRATION.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Exécutant(e) *</label>
          <ExecutantSelect intervenants={intervenants} value={draft.executant} onChange={(v) => set("executant", v)} onAdded={onIntervenantAdded} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Dose</label>
          <input type="number" min={0} step="0.1" value={draft.dose} onChange={(e) => set("dose", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Unité</label>
          <input value={draft.uniteDosage} onChange={(e) => set("uniteDosage", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ml" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Motif</label>
          <input value={draft.motif} onChange={(e) => set("motif", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ex: Mammite" />
        </div>
      </div>
    </div>
  );
}

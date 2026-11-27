"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { formatDoseBase, VOIES_ADMINISTRATION } from "@/lib/medicament-categories";
import MedicamentPicker, { type MedicamentOption, type PreconisationOption } from "./MedicamentPicker";
import ExecutantSelect, { type Intervenant } from "./ExecutantSelect";
import { calculerDose, formatBaseKg, preconisationsPourVoie, referencePourCalcul, type ReferenceDose } from "./saisie-traitement";

export interface TraitementDraft {
  key: string;
  medicament: MedicamentOption | null;
  voie: string;
  executant?: string;
  dose: string;
  uniteDosage: string;
  motif: string;
  doseUnique: boolean;
  frequence: string;
  dureeJours: string;
}

interface Props {
  draft: TraitementDraft;
  medicaments: MedicamentOption[];
  intervenants: Intervenant[];
  executantParDefaut: string;
  animalPourCalcul: string | null;
  onChange: (draft: TraitementDraft) => void;
  onRemove: () => void;
  onIntervenantAdded: (i: Intervenant) => void;
  removable: boolean;
}

function libelleDose(p: PreconisationOption): string | null {
  if (p.dose == null || !p.unite?.trim() || !p.doseBase?.trim()) return null;
  return `${p.dose} ${p.unite} ${formatBaseKg(p.doseBase) ?? formatDoseBase(p.doseBase)}`;
}

function statutPosologie(statut: string): string {
  if (statut === "VALIDE") return "Validée";
  return statut === "A_VERIFIER" ? "À vérifier" : "Importée, à vérifier";
}

function PosologiePharmacie({ medicament, voie, animalId }: {
  medicament: MedicamentOption;
  voie: string;
  animalId: string | null;
}) {
  const preconisations = medicament.preconisations ?? [];
  const pourVoie = preconisationsPourVoie(preconisations, voie);
  const principale = pourVoie.length === 1 ? pourVoie[0] : null;
  const affichage = principale && libelleDose(principale);
  const reference = referencePourCalcul(preconisations, voie);
  const ancienneDose = pourVoie.length === 0 && preconisations.length === 0 &&
    voie && medicament.voie?.trim().toUpperCase() === voie.trim().toUpperCase() &&
    medicament.dosagePourKg != null && medicament.uniteDosage?.trim()
    ? `${medicament.dosagePourKg} ${medicament.uniteDosage} par kg`
    : null;
  const message = !voie ? "Choisis la voie d’administration"
    : pourVoie.length > 1 ? "Plusieurs références pour cette voie"
      : "Pas de posologie complète pour cette voie";

  return (
    <section aria-label="Posologie de la pharmacie" className="rounded-lg border border-gray-200 bg-white px-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-2">
        <span className="text-gray-600">Posologie pharmacie</span>
        <strong>{affichage || ancienneDose || message}</strong>
        {affichage && principale && principale.statut !== "VALIDE" && (
          <span className="font-medium text-amber-900">{statutPosologie(principale.statut)}</span>
        )}
        {ancienneDose && <span className="font-medium text-amber-900">À vérifier</span>}
      </div>
      <details>
        <summary className="min-h-11 cursor-pointer py-3 font-medium text-blue-800">Détails de la posologie</summary>
        <div className="space-y-2 pb-3">
          {preconisations.map((p) => {
            const duree = p.dureeValeur != null && p.dureeUnite
              ? `${p.dureeValeur} ${p.dureeUnite === "JOUR" ? (p.dureeValeur === 1 ? "jour" : "jours") : p.dureeUnite.toLowerCase()}`
              : null;
            const consignes = [p.frequence, duree,
              p.delaiAttenteViandeJ != null ? `Attente viande : ${p.delaiAttenteViandeJ} j` : null,
              p.delaiAttenteLaitTraites != null ? `Attente lait : ${p.delaiAttenteLaitTraites} traite(s)` : null,
            ].filter(Boolean);
            return (
              <div key={p.id} className="rounded-md border border-gray-200 p-2">
                <p className="font-medium">{[p.voie, p.indicationMotif, statutPosologie(p.statut)].filter(Boolean).join(" · ")}</p>
                <p>{libelleDose(p) ?? "Posologie incomplète"}</p>
                {consignes.length > 0 && <p className="text-gray-600">{consignes.join(" · ")}</p>}
              </div>
            );
          })}
          <p className="text-gray-600">Attente sur la fiche pharmacie · viande : {medicament.delaiAttenteViandeJ != null ? `${medicament.delaiAttenteViandeJ} j` : "non renseignée"} · lait : {medicament.delaiAttenteLaitJ != null ? `${medicament.delaiAttenteLaitJ} j` : "non renseignée"}</p>
          <a className="inline-flex min-h-11 items-center font-medium text-blue-800 underline" href={`/pharmacie/${medicament.id}`} target="_blank" rel="noopener noreferrer">Voir la fiche pharmacie</a>
        </div>
      </details>
      {animalId && reference && (
        <details className="border-t border-gray-200">
          <summary className="min-h-11 cursor-pointer py-3 font-medium text-blue-800">Calculer avec un poids estimé</summary>
          <CalculDose key={JSON.stringify([animalId, medicament.id, reference.id])} reference={reference} />
        </details>
      )}
    </section>
  );
}

function CalculDose({ reference }: { reference: ReferenceDose }) {
  const [poids, setPoids] = useState("");
  const dose = calculerDose(reference, poids);
  return (
    <div className="space-y-2 pb-3">
      <label className="block">
        <span className="block font-medium">Poids estimé (kg)</span>
        <input type="number" inputMode="decimal" min="0" step="any" value={poids}
          onChange={(event) => setPoids(event.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Facultatif" />
      </label>
      <p aria-live="polite">
        {dose !== null && <><strong>Quantité calculée : {dose} {reference.unite}</strong>. Vérifie le résultat, puis renseigne la dose réellement administrée.</>}
      </p>
    </div>
  );
}

export default function TraitementDraftRow({ draft, medicaments, intervenants, executantParDefaut, animalPourCalcul, onChange, onRemove, onIntervenantAdded, removable }: Props) {
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
      // Une préconisation par kg ou par 100 kg n'est pas une dose administrée.
      // Ne jamais recopier une valeur de référence dans la dose réelle.
      dose: "",
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
            {draft.voie && !VOIES_ADMINISTRATION.some((voie) => voie.code === draft.voie) && (
              <option value={draft.voie}>{draft.voie}</option>
            )}
            {VOIES_ADMINISTRATION.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Exécutant(e) *</label>
          <ExecutantSelect intervenants={intervenants} value={draft.executant ?? executantParDefaut} onChange={(v) => set("executant", v)} onAdded={onIntervenantAdded} />
        </div>
      </div>

      {draft.medicament && (
        <PosologiePharmacie medicament={draft.medicament} voie={draft.voie} animalId={animalPourCalcul} />
      )}

      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Dose administrée</label>
          <input type="number" min={0} step="any" value={draft.dose} onChange={(e) => set("dose", e.target.value)}
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
      <label className="flex min-h-11 items-center gap-2 rounded-lg border bg-white px-3 text-sm">
        <input type="checkbox" checked={draft.doseUnique} onChange={(e) => set("doseUnique", e.target.checked)} className="h-4 w-4 accent-green-700" />
        Dose unique
      </label>
      {!draft.doseUnique && <div className="grid grid-cols-2 gap-2.5">
        <div><label className="text-xs text-gray-500 block mb-1">Fréquence</label><input value={draft.frequence} onChange={(e) => set("frequence", e.target.value)} placeholder="ex : matin et soir" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
        <div><label className="text-xs text-gray-500 block mb-1">Durée (jours)</label><input type="number" min={2} value={draft.dureeJours} onChange={(e) => set("dureeJours", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
      </div>}
    </div>
  );
}

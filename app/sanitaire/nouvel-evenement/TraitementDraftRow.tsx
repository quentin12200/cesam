"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { formatDoseBase, VOIES_ADMINISTRATION } from "@/lib/medicament-categories";
import MedicamentPicker, { type MedicamentOption } from "./MedicamentPicker";
import ExecutantSelect, { type Intervenant } from "./ExecutantSelect";
import { calculerDose, referencePourCalcul, type ReferenceDose } from "./saisie-traitement";

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

function CalculDose({ reference }: { reference: ReferenceDose }) {
  const [poids, setPoids] = useState("");
  const dose = calculerDose(reference, poids);
  return (
    <div className="space-y-2 rounded-md border border-amber-300 bg-white p-2">
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
  const reference = referencePourCalcul(draft.medicament?.preconisations ?? [], draft.voie);
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

      {draft.medicament && (
        <section aria-label="Informations de posologie de la pharmacie" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-2">
          <p className="font-semibold text-amber-950">Posologie de référence — à vérifier avant administration</p>
          <p className="text-xs text-amber-900">Ces informations proviennent de la pharmacie CESAM. La dose administrée reste à renseigner manuellement.</p>
          <p>Fiche pharmacie : {draft.medicament.dosagePourKg != null ? `${draft.medicament.dosagePourKg} ${draft.medicament.uniteDosage ?? "unité non renseignée"} / kg (valeur enregistrée, à vérifier)` : "Aucune posologie par kg renseignée"}</p>
          <p>Voie de la fiche : {draft.medicament.voie || "Non renseignée"}</p>
          <p>Attente viande : {draft.medicament.delaiAttenteViandeJ != null ? `${draft.medicament.delaiAttenteViandeJ} jour(s)` : "Non renseignée"} · Attente lait : {draft.medicament.delaiAttenteLaitJ != null ? `${draft.medicament.delaiAttenteLaitJ} jour(s)` : "Non renseignée"}</p>
          {(draft.medicament.preconisations ?? []).length ? (
            <div className="space-y-2">
              {draft.medicament.preconisations.map((p) => (
                <div key={p.id} className="rounded-md border border-amber-200 bg-white p-2">
                  <p className="font-medium">{p.indicationMotif || "Préconisation sans indication"} · {p.statut === "VALIDE" ? "Validée" : p.statut === "A_VERIFIER" ? "À vérifier" : "Importée / non validée"}</p>
                  <p>Dose de référence : {p.dose != null ? `${p.dose} ${p.unite ?? "unité non renseignée"} ${formatDoseBase(p.doseBase) ?? "(base non renseignée)"}` : "Non renseignée"}</p>
                  <p>Voie : {p.voie || "Non renseignée"} · Fréquence : {p.frequence || "Non renseignée"}</p>
                  <p>Durée : {p.dureeValeur != null ? `${p.dureeValeur} ${p.dureeUnite || "unité non renseignée"}` : "Non renseignée"}</p>
                  <p>Attente viande : {p.delaiAttenteViandeJ != null ? `${p.delaiAttenteViandeJ} j` : "Non renseignée"} · Lait : {p.delaiAttenteLaitTraites != null ? `${p.delaiAttenteLaitTraites} traites` : "Non renseignée"}</p>
                </div>
              ))}
            </div>
          ) : <p>Aucune préconisation enregistrée pour ce médicament.</p>}
          {animalPourCalcul && reference && (
            <CalculDose key={JSON.stringify([animalPourCalcul, draft.medicament.id, reference.id])} reference={reference} />
          )}
          <a className="font-semibold text-blue-800 underline" href={`/pharmacie/${draft.medicament.id}`} target="_blank" rel="noopener noreferrer">Voir la fiche pharmacie</a>
        </section>
      )}
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

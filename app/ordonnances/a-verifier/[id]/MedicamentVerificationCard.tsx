"use client";

import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Pencil } from "lucide-react";
import RecordActionsMenu from "@/components/RecordActionsMenu";
import type { MedicamentPropose } from "@/lib/ordonnance-types";
import {
  analyserPresentation,
  formaterDose,
  formaterRenouvellement,
  formaterRythme,
  formaterVoie,
} from "@/lib/ordonnance-display";

export interface MedicationFields {
  key: string;
  ia?: MedicamentPropose;
  medicationId: string;
  createMedication: boolean;
  categoryConfirmed: boolean;
  medicamentNom: string;
  numeroLot: string;
  substanceActive: string;
  concentration: string;
  categorie: string;
  familleTherapeutique: string;
  formePharmaceutique: string;
  conditionnement: string;
  doseValue: string;
  doseUnit: string;
  referenceValue: string;
  referenceUnit: string;
  referenceType: string;
  normalizedDoseValue: string;
  normalizedDoseUnit: string;
  voie: string;
  administrationCount: string;
  administrationIntervalHours: string;
  treatmentDurationDays: string;
  repeatCondition: string;
  administrationInstructions: string;
  meatDays: string;
  offalDays: string;
  milkDays: string;
  precautions: string;
}

const inputClass = "min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100";

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "block sm:col-span-2" : "block"}>
      <span className="mb-1 block text-[11px] font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function Ligne({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <p><span className="font-medium text-gray-500">{label} :</span> {value}</p>;
}

export default function MedicamentVerificationCard({
  med,
  index,
  total,
  onChange,
  onDecision,
  onUseMatch,
  onRemove,
}: {
  med: MedicationFields;
  index: number;
  total: number;
  onChange: (field: keyof MedicationFields, value: string) => void;
  onDecision: (values: Partial<Pick<MedicationFields, "medicationId" | "createMedication" | "categoryConfirmed">>) => void;
  onUseMatch: (matchId?: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [validated, setValidated] = useState(false);
  const match = med.ia?.medicationMatches.find((item) => item.id === med.medicationId)
    ?? (med.medicationId ? med.ia?.medicationMatch : null);
  const presentation = analyserPresentation(med.conditionnement);
  const dose = formaterDose(med);
  const rythme = formaterRythme(med);
  const renouvellement = formaterRenouvellement(med);
  const voie = formaterVoie(med.voie);
  const nomAffiche = match?.nom ?? (med.medicamentNom || `Médicament ${index + 1}`);
  const delaisComplets = med.meatDays || med.offalDays || med.milkDays;
  const viandeEtAbats = med.meatDays && med.offalDays && med.meatDays === med.offalDays;

  const change = (field: keyof MedicationFields, value: string) => {
    setValidated(false);
    onChange(field, value);
  };

  return (
    <article className={`rounded-xl border bg-white p-3 shadow-sm ${validated ? "border-green-300" : "border-gray-200"}`}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Médicament {index + 1}</p>
          <h3 className="truncate text-lg font-bold text-gray-950">{nomAffiche}</h3>
          {(presentation.presentation || presentation.quantite !== null) && (
            <p className="mt-0.5 text-sm text-gray-600">
              {presentation.quantite !== null && presentation.presentation ? `${presentation.quantite} ` : ""}
              {presentation.presentation}{presentation.presentation && presentation.quantite !== null ? " · " : ""}
              {presentation.quantite !== null ? `Quantité : ${presentation.quantite}` : ""}
            </p>
          )}
        </div>
        {total > 1 && (
          <RecordActionsMenu actions={[{
            label: "Retirer ce médicament",
            tone: "danger",
            confirmMessage: "Retirer ce médicament des informations détectées ?",
            onSelect: onRemove,
          }]} />
        )}
      </header>

      <div className="mt-3 space-y-1.5 text-sm text-gray-800">
        <Ligne label="Voie" value={voie} />
        <Ligne label="Dose" value={dose} />
        <Ligne label="Rythme" value={rythme} />
        <Ligne label="Durée" value={med.treatmentDurationDays ? `${med.treatmentDurationDays} jour${med.treatmentDurationDays === "1" ? "" : "s"}` : null} />
        <Ligne label="Renouvellement" value={renouvellement} />
      </div>

      <div className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-950">
        <p className="font-semibold">Délais d’attente</p>
        {delaisComplets ? (
          <p className="mt-0.5">
            {viandeEtAbats
              ? `Viande et abats : ${med.meatDays} j`
              : [med.meatDays && `Viande : ${med.meatDays} j`, med.offalDays && `Abats : ${med.offalDays} j`].filter(Boolean).join(" · ")}
            {med.milkDays ? `${med.meatDays || med.offalDays ? " · " : ""}Lait : ${med.milkDays} j` : ""}
          </p>
        ) : <p className="mt-0.5 text-orange-800">Délai non détecté — à vérifier</p>}
      </div>

      {med.medicationId ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
          <CheckCircle2 size={15} /> Médicament reconnu dans la pharmacie
        </div>
      ) : med.ia && med.ia.medicationMatches.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} /> Plusieurs correspondances possibles — à confirmer</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {med.ia.medicationMatches.map((candidate) => (
              <button key={candidate.id} type="button" onClick={() => onUseMatch(candidate.id)} className="min-h-9 rounded-lg border border-amber-400 bg-white px-3 font-semibold">
                Utiliser cette fiche : {candidate.nom}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
          <p className="font-semibold">Nouveau médicament</p>
          <p className="mt-0.5">Aucun nom commercial suffisamment proche n’a été trouvé.</p>
          <button type="button" onClick={() => onDecision({ medicationId: "", createMedication: !med.createMedication })} className="mt-2 min-h-9 rounded-lg border border-blue-600 bg-white px-3 font-semibold">
            {med.createMedication ? "Création confirmée" : "Créer cette fiche après vérification"}
          </button>
        </div>
      )}

      <details className="group mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between font-semibold">
          Voir les détails <ChevronDown size={15} className="transition group-open:rotate-180" />
        </summary>
        <div className="mt-2 grid gap-x-4 gap-y-1 border-t border-gray-200 pt-2 sm:grid-cols-2">
          <Ligne label="Substance active" value={med.substanceActive || null} />
          <Ligne label="Concentration" value={med.concentration || null} />
          <Ligne label="Catégorie" value={med.categorie || null} />
          <Ligne label="Famille thérapeutique" value={med.familleTherapeutique || null} />
          <Ligne label="Forme pharmaceutique" value={med.formePharmaceutique || null} />
          <Ligne label="Lot" value={med.numeroLot || null} />
          <Ligne label="Dose normalisée" value={med.normalizedDoseValue && med.normalizedDoseUnit ? `${med.normalizedDoseValue} ${med.normalizedDoseUnit}` : null} />
          <Ligne label="Précautions" value={med.precautions || null} />
        </div>
        {med.ia && Object.keys(med.ia.evidence).length > 0 && (
          <div className="mt-2 border-t border-gray-200 pt-2">
            <p className="font-semibold text-gray-600">Lecture OCR</p>
            {Object.entries(med.ia.evidence).map(([key, evidence]) => (
              <p key={key} className="mt-1 text-gray-500">
                {key} : {evidence.sourceText ?? "source non disponible"} · confiance {Math.round(evidence.confidence * 100)} %
              </p>
            ))}
          </div>
        )}
      </details>

      {editing && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-3 text-xs font-semibold text-gray-700">Modifier les informations</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom du médicament *" wide><input required value={med.medicamentNom} onChange={(e) => change("medicamentNom", e.target.value)} className={inputClass} /></Field>
            <Field label="Présentation et quantité délivrée" wide><input value={med.conditionnement} onChange={(e) => change("conditionnement", e.target.value)} className={inputClass} placeholder="1 flacon de 100 ml" /></Field>
            <Field label="Voie"><input value={med.voie} onChange={(e) => change("voie", e.target.value)} className={inputClass} /></Field>
            <Field label="N° de lot"><input value={med.numeroLot} onChange={(e) => change("numeroLot", e.target.value)} className={inputClass} /></Field>
            <Field label="Dose"><input type="number" min="0" step="0.01" value={med.doseValue} onChange={(e) => change("doseValue", e.target.value)} className={inputClass} /></Field>
            <Field label="Unité"><input value={med.doseUnit} onChange={(e) => change("doseUnit", e.target.value)} className={inputClass} /></Field>
            <Field label="Pour"><input type="number" min="0" step="0.01" value={med.referenceValue} onChange={(e) => change("referenceValue", e.target.value)} className={inputClass} /></Field>
            <Field label="Unité de référence"><input value={med.referenceUnit} onChange={(e) => change("referenceUnit", e.target.value)} className={inputClass} /></Field>
            <Field label="Type de dose"><select value={med.referenceType} onChange={(e) => change("referenceType", e.target.value)} className={inputClass}><option value="">Non précisé</option><option value="live_weight">Selon le poids vif</option><option value="animal">Par animal</option></select></Field>
            <Field label="Rythme / instructions"><input value={med.administrationInstructions} onChange={(e) => change("administrationInstructions", e.target.value)} className={inputClass} /></Field>
            <Field label="Nombre d’administrations"><input type="number" min="0" value={med.administrationCount} onChange={(e) => change("administrationCount", e.target.value)} className={inputClass} /></Field>
            <Field label="Intervalle (heures)"><input type="number" min="0" value={med.administrationIntervalHours} onChange={(e) => change("administrationIntervalHours", e.target.value)} className={inputClass} /></Field>
            <Field label="Durée (jours)"><input type="number" min="0" value={med.treatmentDurationDays} onChange={(e) => change("treatmentDurationDays", e.target.value)} className={inputClass} /></Field>
            <Field label="Condition de renouvellement"><input value={med.repeatCondition} onChange={(e) => change("repeatCondition", e.target.value)} className={inputClass} /></Field>
            <Field label="Viande (jours)"><input type="number" min="0" value={med.meatDays} onChange={(e) => change("meatDays", e.target.value)} className={inputClass} /></Field>
            <Field label="Abats (jours)"><input type="number" min="0" value={med.offalDays} onChange={(e) => change("offalDays", e.target.value)} className={inputClass} /></Field>
            <Field label="Lait (jours)"><input type="number" min="0" value={med.milkDays} onChange={(e) => change("milkDays", e.target.value)} className={inputClass} /></Field>
            <Field label="Substance active"><input value={med.substanceActive} onChange={(e) => change("substanceActive", e.target.value)} className={inputClass} /></Field>
            <Field label="Concentration"><input value={med.concentration} onChange={(e) => change("concentration", e.target.value)} className={inputClass} /></Field>
            <Field label="Catégorie"><input value={med.categorie} onChange={(e) => change("categorie", e.target.value)} className={inputClass} /></Field>
            <Field label="Famille thérapeutique"><input value={med.familleTherapeutique} onChange={(e) => change("familleTherapeutique", e.target.value)} className={inputClass} /></Field>
            <Field label="Forme pharmaceutique"><input value={med.formePharmaceutique} onChange={(e) => change("formePharmaceutique", e.target.value)} className={inputClass} /></Field>
            <Field label="Dose normalisée"><input type="number" min="0" step="0.001" value={med.normalizedDoseValue} onChange={(e) => change("normalizedDoseValue", e.target.value)} className={inputClass} /></Field>
            <Field label="Unité normalisée"><input value={med.normalizedDoseUnit} onChange={(e) => change("normalizedDoseUnit", e.target.value)} className={inputClass} /></Field>
            <Field label="Précautions" wide><textarea value={med.precautions} onChange={(e) => change("precautions", e.target.value)} rows={2} className={inputClass} /></Field>
          </div>
          {med.createMedication && med.categorie && (
            <button type="button" onClick={() => onDecision({ categoryConfirmed: !med.categoryConfirmed })} className="mt-3 min-h-10 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900">
              {med.categoryConfirmed ? "✓ Catégorie vérifiée" : "Suggestion IA — confirmer la catégorie"}
            </button>
          )}
        </div>
      )}

      <footer className="mt-3 flex gap-2">
        <button type="button" onClick={() => setEditing((value) => !value)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700">
          <Pencil size={14} /> {editing ? "Fermer la modification" : "Modifier"}
        </button>
        <button type="button" onClick={() => { setValidated(true); setEditing(false); }} className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${validated ? "bg-green-100 text-green-800" : "bg-green-700 text-white"}`}>
          <Check size={15} /> {validated ? "Validé" : "Valider"}
        </button>
      </footer>
    </article>
  );
}

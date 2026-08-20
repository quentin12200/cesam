"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, FileText, Loader2, Plus } from "lucide-react";
import {
  medicamentsDepuisProposition,
  type MedicamentCorrespondant,
  type MedicamentPropose,
  type PropositionOrdonnance,
} from "@/lib/ordonnance-types";
import {
  securiserDateDelivrance,
  sourceIndiqueDelivreCeJour,
  sourceJustifieDateDelivrance,
} from "@/lib/ordonnance-dates";
import { useOriginNavigation } from "@/lib/use-origin-navigation";
import { normaliserConditionnementExtrait, resoudreSourcesDose } from "@/lib/ordonnance-display";
import MedicamentVerificationCard, { type MedicationFields } from "./MedicamentVerificationCard";

interface ExtractionInfo {
  id: string;
  documentUrls: string[];
  modele: string;
  versionPrompt: string;
  analyseLe: string;
}

let compteurCle = 0;
function nouvelleCle(): string {
  compteurCle += 1;
  return `med-${compteurCle}-${Math.random().toString(36).slice(2)}`;
}

function s(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function versChamps(m: MedicamentPropose): MedicationFields {
  const presentationValue = m.evidence.presentation?.value;
  const presentation = presentationValue && typeof presentationValue === "object"
    ? presentationValue as Record<string, unknown>
    : null;
  const sourcesConditionnement = ["conditionnement", "presentation", "deliveredQuantity"]
    .map((cle) => m.evidence[cle]?.sourceText)
    .filter((value): value is string => Boolean(value));
  const conditionnement = normaliserConditionnementExtrait({
    conditionnement: s(m.conditionnement),
    presentation,
    sourceTexts: sourcesConditionnement,
  });
  const doseInitiale = {
    doseValue: s(m.doseValue),
    doseUnit: s(m.doseUnit),
    referenceValue: s(m.referenceValue),
    referenceUnit: s(m.referenceUnit),
    referenceType: s(m.referenceType),
  };
  const resolutionDose = resoudreSourcesDose({
    ...doseInitiale,
    doseSourceText: m.evidence.dose?.sourceText,
    dosePratique: m.dosePratique ?? null,
    dosePharmacologique: m.dosePharmacologique ?? null,
  });
  const doseSources = {
    ...resolutionDose,
    sourceHybrideDetectee: resolutionDose.sourceHybrideDetectee || m.doseSourceConflict === true,
  };
  const doseRetenue = doseSources.doseAffichee ?? {
    doseValue: "", doseUnit: "", referenceValue: "", referenceUnit: "", referenceType: "", sourceText: null,
  };
  return {
    key: nouvelleCle(),
    ia: m,
    medicationId: m.medicationMatchStatus === "matched" ? m.medicationMatch?.id ?? "" : "",
    createMedication: false,
    categoryConfirmed: false,
    medicamentNom: s(m.medicamentNom),
    numeroLot: s(m.numeroLot),
    substanceActive: s(m.substanceActive),
    concentration: s(m.concentration),
    categorie: s(m.categorie),
    familleTherapeutique: s(m.familleTherapeutique),
    formePharmaceutique: s(m.formePharmaceutique),
    conditionnement: conditionnement ?? "",
    doseValue: doseRetenue.doseValue,
    doseUnit: doseRetenue.doseUnit,
    referenceValue: doseRetenue.referenceValue,
    referenceUnit: doseRetenue.referenceUnit,
    referenceType: doseRetenue.referenceType,
    doseSources,
    doseManuallyEdited: false,
    normalizedDoseValue: s(m.normalizedDoseValue),
    normalizedDoseUnit: s(m.normalizedDoseUnit),
    voie: s(m.voie),
    administrationCount: s(m.administrationCount),
    administrationIntervalHours: s(m.administrationIntervalHours),
    treatmentDurationDays: s(m.treatmentDurationDays),
    repeatCondition: s(m.repeatCondition),
    administrationInstructions: s(m.administrationInstructions),
    meatDays: s(m.withdrawalPeriods.meatDays),
    offalDays: s(m.withdrawalPeriods.offalDays),
    milkDays: s(m.withdrawalPeriods.milkDays),
    precautions: s(m.precautions),
  };
}

function champsVides(): MedicationFields {
  return {
    key: nouvelleCle(), medicationId: "", createMedication: false, categoryConfirmed: false,
    medicamentNom: "", numeroLot: "", substanceActive: "", concentration: "", categorie: "",
    familleTherapeutique: "", formePharmaceutique: "", conditionnement: "", doseValue: "",
    doseUnit: "", referenceValue: "", referenceUnit: "", referenceType: "", normalizedDoseValue: "",
    doseManuallyEdited: false,
    doseSources: { dosePratique: null, dosePharmacologique: null, doseAffichee: null, sourceHybrideDetectee: false },
    normalizedDoseUnit: "", voie: "", administrationCount: "", administrationIntervalHours: "",
    treatmentDurationDays: "", repeatCondition: "", administrationInstructions: "", meatDays: "",
    offalDays: "", milkDays: "", precautions: "",
  };
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

export default function VerificationOrdonnanceClient({
  extraction,
  propositionInitiale,
  medicamentsPharmacie: medicamentsPharmacieInitiaux,
}: {
  extraction: ExtractionInfo;
  propositionInitiale: PropositionOrdonnance;
  medicamentsPharmacie: MedicamentCorrespondant[];
}) {
  const router = useRouter();
  const { completeToOrigin, returnTo } = useOriginNavigation();
  const [prescriptionDate, setPrescriptionDate] = useState(
    (propositionInitiale.prescriptionDate ?? propositionInitiale.dateDebut)?.slice(0, 10) ?? "",
  );
  const [lastVisitDate, setLastVisitDate] = useState(propositionInitiale.lastVisitDate?.slice(0, 10) ?? "");
  const deliveryEvidence = propositionInitiale.evidence?.deliveryDate;
  const deliveryDateSourcee = sourceJustifieDateDelivrance(deliveryEvidence?.sourceText);
  const initialDeliveryDate = securiserDateDelivrance(propositionInitiale.deliveryDate, deliveryEvidence)?.slice(0, 10) ?? "";
  const [deliveryDate, setDeliveryDate] = useState(initialDeliveryDate);
  const [ordonnanceNumero, setOrdonnanceNumero] = useState(propositionInitiale.ordonnanceNumero ?? "");
  const [veterinaire, setVeterinaire] = useState(propositionInitiale.veterinaire ?? "");
  const [motif, setMotif] = useState(propositionInitiale.motif ?? "");
  const [animaux, setAnimaux] = useState("");
  const [medicaments, setMedicaments] = useState<MedicationFields[]>(
    medicamentsDepuisProposition(propositionInitiale).map(versChamps),
  );
  const [medicamentsPharmacie, setMedicamentsPharmacie] = useState(medicamentsPharmacieInitiaux);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const medicamentsRattaches = medicaments.filter((med) => med.medicationId).length;
  const medicamentsAConfirmer = medicaments.filter((med) => {
    const associationAConfirmer = !med.medicationId && !med.createMedication;
    const doseAConfirmer = !med.doseManuallyEdited && (
      med.doseSources.sourceHybrideDetectee
      || (med.ia?.dosesPratiques ?? []).some((dose) => dose.aVerifier)
    );
    return associationAConfirmer || doseAConfirmer;
  }).length;
  const delivreCeJour = sourceIndiqueDelivreCeJour(deliveryEvidence?.sourceText);
  const masquerDateDelivrance = delivreCeJour
    || Boolean(deliveryDate && prescriptionDate && deliveryDate === prescriptionDate);

  function majMed(index: number, field: keyof MedicationFields, value: string) {
    const champDose = ["doseValue", "doseUnit", "referenceValue", "referenceUnit", "referenceType"].includes(field);
    setMedicaments((previous) => previous.map((med, i) => (i === index ? {
      ...med,
      [field]: value,
      doseManuallyEdited: med.doseManuallyEdited || champDose,
    } : med)));
  }

  function majDecision(index: number, values: Partial<Pick<MedicationFields, "medicationId" | "createMedication" | "categoryConfirmed">>) {
    setMedicaments((previous) => previous.map((med, i) => (i === index ? { ...med, ...values } : med)));
  }

  function utiliserFiche(index: number, matchId?: string) {
    setMedicaments((previous) => previous.map((med, i) => {
      if (i !== index) return med;
      const match = med.ia?.medicationMatches.find((item) => item.id === matchId)
        ?? med.ia?.medicationMatch
        ?? medicamentsPharmacie.find((item) => item.id === matchId);
      if (!match) return med;
      return {
        ...med,
        medicationId: match.id,
        createMedication: false,
        substanceActive: match.dci ?? med.substanceActive,
        categorie: match.categorieLabel,
        formePharmaceutique: match.forme ?? med.formePharmaceutique,
        voie: match.voie ?? med.voie,
        meatDays: med.meatDays || s(match.delaiAttenteViandeJ),
        offalDays: med.offalDays || s(match.delaiAttenteViandeJ),
        milkDays: med.milkDays || s(match.delaiAttenteLaitJ),
      };
    }));
  }

  async function creerDansPharmacie(index: number, values: Record<string, unknown>) {
    const response = await fetch(`/api/extractions-ordonnance/${extraction.id}/medicaments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, confirmed: true }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const candidats = Array.isArray(data.candidats) ? data.candidats as MedicamentCorrespondant[] : [];
      if (candidats.length > 0) {
        setMedicamentsPharmacie((previous) => [
          ...previous,
          ...candidats.filter((candidate) => !previous.some((item) => item.id === candidate.id)),
        ]);
      }
      throw new Error(data.error ?? "La fiche Pharmacie n’a pas pu être créée.");
    }
    const created = data.medicament as MedicamentCorrespondant;
    setMedicamentsPharmacie((previous) => previous.some((item) => item.id === created.id)
      ? previous : [...previous, created]);
    setMedicaments((previous) => previous.map((med, i) => i === index ? {
      ...med,
      medicationId: created.id,
      createMedication: false,
      categoryConfirmed: true,
      substanceActive: created.dci ?? med.substanceActive,
      formePharmaceutique: created.forme ?? med.formePharmaceutique,
      categorie: created.categorieLabel,
      voie: created.voie ?? med.voie,
    } : med));
  }

  async function valider(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/extractions-ordonnance/${extraction.id}/valider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescriptionDate,
          lastVisitDate,
          deliveryDate: delivreCeJour ? prescriptionDate : deliveryDate,
          ordonnanceNumero,
          veterinaire,
          motif,
          animaux,
          evidence: propositionInitiale.evidence ?? {},
          medicaments: medicaments.map((med) => ({
            medicationId: med.medicationId || null,
            createMedication: med.createMedication,
            categoryConfirmed: med.categoryConfirmed,
            medicamentNom: med.medicamentNom,
            numeroLot: med.numeroLot,
            substanceActive: med.substanceActive,
            concentration: med.concentration,
            categorie: med.categorie,
            familleTherapeutique: med.familleTherapeutique,
            formePharmaceutique: med.formePharmaceutique,
            conditionnement: med.conditionnement,
            doseValue: med.doseValue,
            doseUnit: med.doseUnit,
            referenceValue: med.referenceValue,
            referenceUnit: med.referenceUnit,
            referenceType: med.referenceType,
            normalizedDoseValue: med.normalizedDoseValue,
            normalizedDoseUnit: med.normalizedDoseUnit,
            dosesPratiques: med.doseManuallyEdited && med.doseValue && med.doseUnit ? [{
              categorieAnimaux: null,
              doseValue: med.doseValue,
              doseUnit: med.doseUnit,
              poidsMinKg: med.referenceUnit.toLowerCase() === "kg" ? med.referenceValue || null : null,
              poidsMaxKg: med.referenceUnit.toLowerCase() === "kg" ? med.referenceValue || null : null,
              frequence: null,
              maximum: false,
              origine: "manuelle",
              sourceText: null,
              aVerifier: false,
            }] : med.ia?.dosesPratiques ?? [],
            voie: med.voie,
            administrationCount: med.administrationCount,
            administrationIntervalHours: med.administrationIntervalHours,
            treatmentDurationDays: med.treatmentDurationDays,
            repeatCondition: med.repeatCondition,
            administrationInstructions: med.administrationInstructions,
            withdrawalPeriods: { meatDays: med.meatDays, offalDays: med.offalDays, milkDays: med.milkDays },
            precautions: med.precautions,
            evidence: {
              ...(med.ia?.evidence ?? {}),
              ...(med.doseSources.dosePratique ? {
                dosePratique: {
                  value: med.doseSources.dosePratique,
                  sourceText: med.doseSources.dosePratique.sourceText,
                  confidence: med.ia?.evidence.dose?.confidence ?? 0,
                },
              } : {}),
              ...(med.doseSources.dosePharmacologique ? {
                dosePharmacologique: {
                  value: med.doseSources.dosePharmacologique,
                  sourceText: med.doseSources.dosePharmacologique.sourceText,
                  confidence: med.ia?.evidence.dose?.confidence ?? 0,
                },
              } : {}),
            },
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "La validation a échoué");
      if (completeToOrigin("✓ Ordonnance enregistrée !")) return;
      router.push(data.count > 1 ? "/ordonnances" : `/ordonnances/${data.ordonnanceId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La validation a échoué");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={valider} className="grid items-start gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm lg:sticky lg:top-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><FileText size={16} className="text-blue-600" /> Document analysé</h2>
        <div className="space-y-3">
          {extraction.documentUrls.map((url, index) => (
            <div key={url}>
              <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
                <span>Page {index + 1}</span>
                <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium"><ExternalLink size={12} /> Ouvrir</a>
              </div>
              {url.toLowerCase().includes(".pdf")
                ? <iframe src={url} title={`Page ${index + 1}`} className="h-[60vh] min-h-80 w-full rounded-lg border border-gray-200 bg-gray-50" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={url} alt={`Page ${index + 1}`} className="max-h-[70vh] w-full rounded-lg border border-gray-200 object-contain" />}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-gray-400">Analyse du {new Date(extraction.analyseLe).toLocaleString("fr-FR")}</p>
      </section>

      <section className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Ordonnance</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date de l’ordonnance *"><input type="date" required value={prescriptionDate} onChange={(event) => setPrescriptionDate(event.target.value)} className={inputClass} /></Field>
            {lastVisitDate && <Field label="Dernière visite"><input type="date" value={lastVisitDate} onChange={(event) => setLastVisitDate(event.target.value)} className={inputClass} /></Field>}
            {deliveryDateSourcee && !masquerDateDelivrance && <Field label="Date de délivrance"><input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className={inputClass} /></Field>}
            <Field label="Numéro ou référence"><input value={ordonnanceNumero} onChange={(event) => setOrdonnanceNumero(event.target.value)} className={inputClass} /></Field>
            <Field label="Vétérinaire ou prescripteur" wide><input value={veterinaire} onChange={(event) => setVeterinaire(event.target.value)} className={inputClass} /></Field>
            <Field label="Motif ou diagnostic"><input value={motif} onChange={(event) => setMotif(event.target.value)} className={inputClass} /></Field>
            <Field label="Animaux concernés"><input value={animaux} onChange={(event) => setAnimaux(event.target.value)} className={inputClass} placeholder="N° travail, lot ou catégorie" /></Field>
          </div>
          {propositionInitiale.evidence && Object.keys(propositionInitiale.evidence).length > 0 && (
            <details className="mt-3 text-xs text-gray-500"><summary className="cursor-pointer font-semibold">Voir la lecture IA</summary><div className="mt-2 space-y-1">{Object.entries(propositionInitiale.evidence).map(([key, evidence]) => <p key={key}>{key} : {evidence.sourceText ?? "source non disponible"} · confiance {Math.round(evidence.confidence * 100)} %</p>)}</div></details>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-800">{medicaments.length} médicament{medicaments.length > 1 ? "s" : ""} détecté{medicaments.length > 1 ? "s" : ""}</h2>
            <span className="text-[11px] text-gray-400">Une seule ordonnance</span>
          </div>
          <div className="space-y-3">
            {medicaments.map((med, index) => (
              <MedicamentVerificationCard
                key={med.key}
                med={med}
                index={index}
                total={medicaments.length}
                onChange={(field, value) => majMed(index, field, value)}
                onDecision={(values) => majDecision(index, values)}
                onUseMatch={(matchId) => utiliserFiche(index, matchId)}
                onCreateInPharmacy={(values) => creerDansPharmacie(index, values)}
                pharmacyOptions={medicamentsPharmacie}
                onRemove={() => setMedicaments((previous) => previous.filter((_, i) => i !== index))}
              />
            ))}
          </div>
          <button type="button" onClick={() => setMedicaments((previous) => [...previous, champsVides()])} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-3 text-sm font-medium text-gray-600">
            <Plus size={15} /> Ajouter un médicament
          </button>

          {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="mt-3 space-y-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
            <p>🟢 Médicaments reconnus : {medicamentsRattaches}</p>
            <p>🟠 À vérifier : {medicamentsAConfirmer}</p>
            {medicamentsAConfirmer === 0
              ? <p className="font-semibold text-green-800">✅ Tous les médicaments sont prêts à être enregistrés.</p>
              : <p className="font-semibold text-amber-800">Choisissez une fiche ou confirmez la création avant de valider.</p>}
          </div>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href={returnTo ?? "/ordonnances"} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-600">Vérifier plus tard</Link>
            <button type="submit" disabled={saving || medicamentsAConfirmer > 0} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-green-700 px-5 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}{saving ? "Validation…" : "Valider l’ordonnance"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}

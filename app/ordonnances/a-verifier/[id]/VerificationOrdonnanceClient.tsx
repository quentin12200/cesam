"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Loader2, Plus } from "lucide-react";
import {
  medicamentsDepuisProposition,
  type MedicamentPropose,
  type PropositionOrdonnance,
} from "@/lib/ordonnance-types";
import RecordActionsMenu from "@/components/RecordActionsMenu";
import { useOriginNavigation } from "@/lib/use-origin-navigation";
import { securiserDateDelivrance, sourceJustifieDateDelivrance } from "@/lib/ordonnance-dates";

interface ExtractionInfo {
  id: string;
  documentUrls: string[];
  modele: string;
  versionPrompt: string;
  analyseLe: string;
}

interface MedChamps {
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

let compteurCle = 0;
function nouvelleCle(): string {
  compteurCle += 1;
  return `med-${compteurCle}-${Math.random().toString(36).slice(2)}`;
}

function s(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function versChamps(m: MedicamentPropose): MedChamps {
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
    conditionnement: s(m.conditionnement),
    doseValue: s(m.doseValue),
    doseUnit: s(m.doseUnit),
    referenceValue: s(m.referenceValue),
    referenceUnit: s(m.referenceUnit),
    referenceType: s(m.referenceType),
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

function champsVides(): MedChamps {
  return {
    key: nouvelleCle(),
    medicationId: "", createMedication: false, categoryConfirmed: false,
    medicamentNom: "", numeroLot: "", substanceActive: "", concentration: "", categorie: "",
    familleTherapeutique: "", formePharmaceutique: "", conditionnement: "", doseValue: "",
    doseUnit: "", referenceValue: "", referenceUnit: "", referenceType: "",
    normalizedDoseValue: "", normalizedDoseUnit: "", voie: "", administrationCount: "",
    administrationIntervalHours: "", treatmentDurationDays: "", repeatCondition: "",
    administrationInstructions: "", meatDays: "", offalDays: "", milkDays: "", precautions: "",
  };
}

const inputClass = "min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100";

function AffichageIA({
  valeur,
  preuve,
}: {
  valeur: string | number | null | undefined;
  preuve?: { sourceText: string | null; confidence: number };
}) {
  return (
    <div className={`mt-1 text-[11px] ${preuve && preuve.confidence < 0.7 ? "text-amber-700" : "text-gray-400"}`}>
      <p>IA : {valeur === null || valeur === undefined || valeur === "" ? "non trouvé" : String(valeur)}</p>
      {preuve?.sourceText && <p>Source : “{preuve.sourceText}” · confiance {Math.round(preuve.confidence * 100)} %</p>}
    </div>
  );
}

function Champ({
  label, valeurIA, preuve, children, className = "",
}: {
  label: string;
  valeurIA?: string | number | null;
  preuve?: { sourceText: string | null; confidence: number };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${preuve && preuve.confidence < 0.7 ? "rounded-lg bg-amber-50 p-2" : ""} ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {valeurIA !== undefined && <AffichageIA valeur={valeurIA} preuve={preuve} />}
    </label>
  );
}

export default function VerificationOrdonnanceClient({
  extraction,
  propositionInitiale,
}: {
  extraction: ExtractionInfo;
  propositionInitiale: PropositionOrdonnance;
}) {
  const router = useRouter();
  const { completeToOrigin, returnTo } = useOriginNavigation();
  const medsInitiaux = medicamentsDepuisProposition(propositionInitiale);

  const [prescriptionDate, setPrescriptionDate] = useState(
    (propositionInitiale.prescriptionDate ?? propositionInitiale.dateDebut)?.slice(0, 10) ?? "",
  );
  const [lastVisitDate, setLastVisitDate] = useState(propositionInitiale.lastVisitDate?.slice(0, 10) ?? "");
  const deliveryEvidence = propositionInitiale.evidence?.deliveryDate;
  const deliveryDateSourcee = sourceJustifieDateDelivrance(deliveryEvidence?.sourceText);
  const initialDeliveryDate = securiserDateDelivrance(propositionInitiale.deliveryDate, deliveryEvidence);
  const [deliveryDate, setDeliveryDate] = useState(initialDeliveryDate?.slice(0, 10) ?? "");
  const [ordonnanceNumero, setOrdonnanceNumero] = useState(propositionInitiale.ordonnanceNumero ?? "");
  const [veterinaire, setVeterinaire] = useState(propositionInitiale.veterinaire ?? "");
  const [motif, setMotif] = useState(propositionInitiale.motif ?? "");
  const [animaux, setAnimaux] = useState("");
  const [medicaments, setMedicaments] = useState<MedChamps[]>(medsInitiaux.map(versChamps));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const medicamentsRattaches = medicaments.filter((med) => med.medicationId).length;
  const medicamentsACreer = medicaments.filter((med) => med.createMedication).length;
  const medicamentsAConfirmer = medicaments.length - medicamentsRattaches - medicamentsACreer;

  function majMed(index: number, champ: keyof MedChamps, valeur: string) {
    setMedicaments((prev) => prev.map((m, i) => (i === index ? { ...m, [champ]: valeur } : m)));
  }
  function ajouterMed() {
    setMedicaments((prev) => [...prev, champsVides()]);
  }
  function retirerMed(index: number) {
    setMedicaments((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }
  function majDecisionMed(index: number, values: Partial<Pick<MedChamps, "medicationId" | "createMedication" | "categoryConfirmed">>) {
    setMedicaments((prev) => prev.map((m, i) => (i === index ? { ...m, ...values } : m)));
  }

  function utiliserFiche(index: number, matchId?: string) {
    setMedicaments((prev) => prev.map((med, i) => {
      if (i !== index) return med;
      const match = med.ia?.medicationMatches.find((item) => item.id === matchId)
        ?? med.ia?.medicationMatch;
      if (!match) return med;
      return {
        ...med,
        medicationId: match.id,
        createMedication: false,
        medicamentNom: match.nom,
        substanceActive: match.dci ?? med.substanceActive,
        categorie: match.categorieLabel,
        formePharmaceutique: match.forme ?? med.formePharmaceutique,
        voie: match.voie ?? med.voie,
        meatDays: s(match.delaiAttenteViandeJ ?? med.meatDays),
        offalDays: s(match.delaiAttenteViandeJ ?? med.offalDays),
        milkDays: s(match.delaiAttenteLaitJ ?? med.milkDays),
      };
    }));
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
          deliveryDate,
          ordonnanceNumero,
          veterinaire,
          motif,
          animaux,
          evidence: propositionInitiale.evidence ?? {},
          medicaments: medicaments.map((m) => ({
            medicationId: m.medicationId || null,
            createMedication: m.createMedication,
            categoryConfirmed: m.categoryConfirmed,
            medicamentNom: m.medicamentNom,
            numeroLot: m.numeroLot,
            substanceActive: m.substanceActive,
            concentration: m.concentration,
            categorie: m.categorie,
            familleTherapeutique: m.familleTherapeutique,
            formePharmaceutique: m.formePharmaceutique,
            conditionnement: m.conditionnement,
            doseValue: m.doseValue,
            doseUnit: m.doseUnit,
            referenceValue: m.referenceValue,
            referenceUnit: m.referenceUnit,
            referenceType: m.referenceType,
            normalizedDoseValue: m.normalizedDoseValue,
            normalizedDoseUnit: m.normalizedDoseUnit,
            voie: m.voie,
            administrationCount: m.administrationCount,
            administrationIntervalHours: m.administrationIntervalHours,
            treatmentDurationDays: m.treatmentDurationDays,
            repeatCondition: m.repeatCondition,
            administrationInstructions: m.administrationInstructions,
            withdrawalPeriods: { meatDays: m.meatDays, offalDays: m.offalDays, milkDays: m.milkDays },
            precautions: m.precautions,
            evidence: m.ia?.evidence ?? {},
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "La validation a échoué");
      if (completeToOrigin("✓ Ordonnance enregistrée !")) return;
      if (data.count > 1) {
        router.push("/ordonnances");
      } else {
        router.push(`/ordonnances/${data.ordonnanceId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "La validation a échoué");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={valider} className="grid items-start gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm lg:sticky lg:top-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <FileText size={16} className="text-blue-600" />
            {extraction.documentUrls.length > 1 ? `Document (${extraction.documentUrls.length} pages)` : "Document analysé"}
          </h2>
        </div>
        <div className="space-y-3">
          {extraction.documentUrls.map((url, i) => {
            const isPdf = url.toLowerCase().includes(".pdf");
            return (
              <div key={url}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-gray-500">Page {i + 1}</span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-800"
                  >
                    <ExternalLink size={12} /> Ouvrir
                  </a>
                </div>
                {isPdf ? (
                  <iframe src={url} title={`Page ${i + 1}`} className="h-[60vh] min-h-80 w-full rounded-lg border border-gray-200 bg-gray-50" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`Page ${i + 1}`} className="max-h-[70vh] w-full rounded-lg border border-gray-200 object-contain" />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Analyse du {new Date(extraction.analyseLe).toLocaleString("fr-FR")} · {extraction.modele} · {extraction.versionPrompt}
        </p>
      </section>

      <section className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Ordonnance</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ
              label="Date de l’ordonnance *"
              valeurIA={propositionInitiale.prescriptionDate ?? propositionInitiale.dateDebut}
              preuve={propositionInitiale.evidence?.prescriptionDate as { sourceText: string | null; confidence: number } | undefined}
            >
              <input type="date" required value={prescriptionDate} onChange={(e) => setPrescriptionDate(e.target.value)} className={inputClass} />
            </Champ>
            <Champ
              label="Dernière visite"
              valeurIA={propositionInitiale.lastVisitDate}
              preuve={propositionInitiale.evidence?.lastVisitDate as { sourceText: string | null; confidence: number } | undefined}
            >
              <input type="date" value={lastVisitDate} onChange={(e) => setLastVisitDate(e.target.value)} className={inputClass} />
            </Champ>
            <Champ
              label="Date de délivrance"
              valeurIA={propositionInitiale.deliveryDate}
              preuve={propositionInitiale.evidence?.deliveryDate as { sourceText: string | null; confidence: number } | undefined}
            >
              <input
                type="date"
                value={deliveryDate}
                disabled={!deliveryDateSourcee}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className={inputClass}
              />
              {!deliveryDateSourcee && <span className="mt-1 block text-[11px] text-gray-400">Non trouvée</span>}
            </Champ>
            <Champ label="Numéro ou référence" valeurIA={propositionInitiale.ordonnanceNumero}>
              <input value={ordonnanceNumero} onChange={(e) => setOrdonnanceNumero(e.target.value)} className={inputClass} />
            </Champ>
            <Champ label="Vétérinaire ou prescripteur" valeurIA={propositionInitiale.veterinaire} className="sm:col-span-2">
              <input value={veterinaire} onChange={(e) => setVeterinaire(e.target.value)} className={inputClass} />
            </Champ>
            <Champ label="Motif ou diagnostic" valeurIA={propositionInitiale.motif}>
              <input value={motif} onChange={(e) => setMotif(e.target.value)} className={inputClass} />
            </Champ>
            <Champ label="Animaux concernés">
              <input value={animaux} onChange={(e) => setAnimaux(e.target.value)} className={inputClass} placeholder="N° travail, lot ou catégorie" />
            </Champ>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              {medicaments.length} médicament{medicaments.length > 1 ? "s" : ""} détecté{medicaments.length > 1 ? "s" : ""}
            </h2>
            <span className="text-[11px] text-gray-400">Une seule ordonnance</span>
          </div>

          <div className="space-y-4">
            {medicaments.map((med, i) => {
              const ia = med.ia;
              return (
                <div key={med.key} className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Médicament {i + 1}</span>
                    {medicaments.length > 1 && (
                      <RecordActionsMenu actions={[{
                        label: "Retirer ce médicament",
                        tone: "danger",
                        confirmMessage: "Retirer ce médicament des informations détectées ?",
                        onSelect: () => retirerMed(i),
                      }]} />
                    )}
                  </div>
                  {ia && ia.medicationMatches.length > 0 ? (
                    <div className={`mb-3 rounded-lg border p-3 text-xs ${
                      ia.medicationMatch
                        ? "border-green-200 bg-green-50 text-green-900"
                        : "border-amber-300 bg-amber-50 text-amber-950"
                    }`}>
                      <div className="flex items-start gap-2">
                        {ia.medicationMatch
                          ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                          : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {ia.medicationMatch
                              ? "Médicament retrouvé dans la pharmacie"
                              : "Plusieurs correspondances possibles — à confirmer"}
                          </p>
                          <div className="mt-2 space-y-2">
                            {ia.medicationMatches.map((match) => (
                              <div key={match.id} className="flex flex-col gap-2 rounded-lg border border-current/20 bg-white/70 p-2 sm:flex-row sm:items-center">
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold">{match.nom}</p>
                                  <p>{match.categorieLabel}{match.dci ? ` · ${match.dci}` : ""}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => utiliserFiche(i, match.id)}
                                  className="min-h-10 rounded-lg border border-current px-3 font-semibold"
                                >
                                  {med.medicationId === match.id ? "Fiche utilisée" : "Utiliser cette fiche"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
                      <p className="font-semibold">Nouveau médicament</p>
                      <p className="mt-1">Aucune fiche suffisamment proche n’a été trouvée.</p>
                      <button
                        type="button"
                        onClick={() => majDecisionMed(i, {
                          medicationId: "",
                          createMedication: !med.createMedication,
                        })}
                        className="mt-2 min-h-10 rounded-lg border border-blue-700 px-3 font-semibold"
                      >
                        {med.createMedication ? "Création confirmée" : "Créer cette fiche après vérification"}
                      </button>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Champ label="Nom du médicament *" valeurIA={ia?.medicamentNom} className="sm:col-span-2">
                      <input required value={med.medicamentNom} onChange={(e) => majMed(i, "medicamentNom", e.target.value)} className={`${inputClass} uppercase`} />
                    </Champ>
                    <Champ label="N° de lot" valeurIA={ia?.numeroLot}>
                      <input value={med.numeroLot} onChange={(e) => majMed(i, "numeroLot", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Voie d’administration" valeurIA={ia?.voie}>
                      <input value={med.voie} onChange={(e) => majMed(i, "voie", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Substance active" valeurIA={ia?.substanceActive}>
                      <input value={med.substanceActive} onChange={(e) => majMed(i, "substanceActive", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Concentration" valeurIA={ia?.concentration}>
                      <input value={med.concentration} onChange={(e) => majMed(i, "concentration", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Catégorie" valeurIA={ia?.categorie}>
                      <input value={med.categorie} onChange={(e) => majMed(i, "categorie", e.target.value)} className={inputClass} />
                    </Champ>
                    {med.createMedication && med.categorie && (
                      <button
                        type="button"
                        onClick={() => majDecisionMed(i, { categoryConfirmed: !med.categoryConfirmed })}
                        className={`min-h-11 rounded-lg border px-3 text-left text-xs font-semibold ${
                          med.categoryConfirmed
                            ? "border-green-300 bg-green-50 text-green-800"
                            : "border-amber-300 bg-amber-50 text-amber-900"
                        }`}
                      >
                        {med.categoryConfirmed
                          ? "✓ Catégorie vérifiée"
                          : "Suggestion IA — confirmer la catégorie"}
                      </button>
                    )}
                    <Champ label="Famille thérapeutique" valeurIA={ia?.familleTherapeutique}>
                      <input value={med.familleTherapeutique} onChange={(e) => majMed(i, "familleTherapeutique", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Forme pharmaceutique" valeurIA={ia?.formePharmaceutique}>
                      <input value={med.formePharmaceutique} onChange={(e) => majMed(i, "formePharmaceutique", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Conditionnement" valeurIA={ia?.conditionnement}>
                      <input value={med.conditionnement} onChange={(e) => majMed(i, "conditionnement", e.target.value)} className={inputClass} />
                    </Champ>
                  </div>

                  <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
                    <h3 className="mb-3 text-xs font-semibold text-gray-800">Posologie</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Champ label="Dose" valeurIA={ia?.doseValue} preuve={ia?.evidence.dose as { sourceText: string | null; confidence: number } | undefined}>
                        <input type="number" min="0" step="0.01" value={med.doseValue} onChange={(e) => majMed(i, "doseValue", e.target.value)} className={inputClass} />
                      </Champ>
                      <Champ label="Unité" valeurIA={ia?.doseUnit}>
                        <input value={med.doseUnit} onChange={(e) => majMed(i, "doseUnit", e.target.value)} className={inputClass} placeholder="ml, mg…" />
                      </Champ>
                      <Champ label="Pour" valeurIA={ia?.referenceValue}>
                        <input type="number" min="0" step="0.01" value={med.referenceValue} onChange={(e) => majMed(i, "referenceValue", e.target.value)} className={inputClass} />
                      </Champ>
                      <Champ label="Unité de référence" valeurIA={ia?.referenceUnit}>
                        <input value={med.referenceUnit} onChange={(e) => majMed(i, "referenceUnit", e.target.value)} className={inputClass} placeholder="kg" />
                      </Champ>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <Champ label="Type de dose" valeurIA={ia?.referenceType}>
                        <select value={med.referenceType} onChange={(e) => majMed(i, "referenceType", e.target.value)} className={inputClass}>
                          <option value="">Non précisé</option>
                          <option value="live_weight">Selon le poids vif</option>
                          <option value="animal">Dose fixe par animal</option>
                        </select>
                      </Champ>
                      <Champ label="Dose normalisée" valeurIA={ia?.normalizedDoseValue}>
                        <input type="number" min="0" step="0.001" value={med.normalizedDoseValue} onChange={(e) => majMed(i, "normalizedDoseValue", e.target.value)} className={inputClass} />
                      </Champ>
                      <Champ label="Unité normalisée" valeurIA={ia?.normalizedDoseUnit}>
                        <input value={med.normalizedDoseUnit} onChange={(e) => majMed(i, "normalizedDoseUnit", e.target.value)} className={inputClass} placeholder="ml/kg" />
                      </Champ>
                    </div>
                    {med.doseValue && med.doseUnit && med.referenceValue && med.referenceUnit && (
                      <p className="mt-3 text-sm font-semibold text-gray-900">
                        {med.doseValue} {med.doseUnit} / {med.referenceValue} {med.referenceUnit}{med.referenceType === "live_weight" ? " de poids vif" : ""}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
                    <h3 className="mb-3 text-xs font-semibold text-gray-800">Protocole d’administration</h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Champ label="Nombre initial d’administrations" valeurIA={ia?.administrationCount}>
                        <input type="number" min="0" value={med.administrationCount} onChange={(e) => majMed(i, "administrationCount", e.target.value)} className={inputClass} />
                      </Champ>
                      <Champ label="Intervalle éventuel (heures)" valeurIA={ia?.administrationIntervalHours}>
                        <input type="number" min="0" value={med.administrationIntervalHours} onChange={(e) => majMed(i, "administrationIntervalHours", e.target.value)} className={inputClass} />
                      </Champ>
                      <Champ label="Durée du traitement (jours)" valeurIA={ia?.treatmentDurationDays}>
                        <input type="number" min="0" value={med.treatmentDurationDays} onChange={(e) => majMed(i, "treatmentDurationDays", e.target.value)} className={inputClass} />
                      </Champ>
                      <Champ label="Condition de répétition" valeurIA={ia?.repeatCondition} className="sm:col-span-3">
                        <input value={med.repeatCondition} onChange={(e) => majMed(i, "repeatCondition", e.target.value)} className={inputClass} />
                      </Champ>
                      <Champ label="Instructions" valeurIA={ia?.administrationInstructions} className="sm:col-span-3">
                        <textarea value={med.administrationInstructions} onChange={(e) => majMed(i, "administrationInstructions", e.target.value)} rows={2} className={inputClass} />
                      </Champ>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
                    <h3 className="mb-3 text-xs font-semibold text-orange-950">Délais d’attente</h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Champ label="Viande (jours)" valeurIA={ia?.withdrawalPeriods.meatDays}>
                        <input type="number" min="0" value={med.meatDays} onChange={(e) => majMed(i, "meatDays", e.target.value)} className={inputClass} />
                      </Champ>
                      <Champ label="Abats (jours)" valeurIA={ia?.withdrawalPeriods.offalDays}>
                        <input type="number" min="0" value={med.offalDays} onChange={(e) => majMed(i, "offalDays", e.target.value)} className={inputClass} />
                      </Champ>
                      <Champ label="Lait (jours)" valeurIA={ia?.withdrawalPeriods.milkDays}>
                        <input type="number" min="0" value={med.milkDays} onChange={(e) => majMed(i, "milkDays", e.target.value)} className={inputClass} />
                      </Champ>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Champ label="Précautions" valeurIA={ia?.precautions} className="sm:col-span-2">
                      <textarea value={med.precautions} onChange={(e) => majMed(i, "precautions", e.target.value)} rows={2} className={inputClass} />
                    </Champ>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={ajouterMed}
            className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <Plus size={15} /> Ajouter un médicament
          </button>

          {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <p className="font-semibold">Avant validation</p>
            <p className="mt-1">
              {medicaments.length} médicament{medicaments.length > 1 ? "s" : ""} · {medicamentsRattaches} rattaché{medicamentsRattaches > 1 ? "s" : ""} · {medicamentsACreer} à créer · {medicamentsAConfirmer} à vérifier
            </p>
            {medicamentsAConfirmer > 0 && (
              <p className="mt-1 font-semibold text-amber-800">Choisissez une fiche ou confirmez la création avant de valider.</p>
            )}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href={returnTo ?? "/ordonnances"} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Vérifier plus tard
            </Link>
            <button
              type="submit"
              disabled={saving || medicamentsAConfirmer > 0}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-green-700 px-5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
              {saving ? "Validation…" : "Valider l’ordonnance"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}

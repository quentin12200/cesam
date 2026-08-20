import { CATEGORIES_MEDICAMENT } from "./medicament-categories.ts";
import {
  normaliserNomMedicament,
  trouverCorrespondancesMedicaments,
  trouverMedicament,
} from "./ordonnance-extraction.ts";
import {
  chargerCandidatsOrdonnance,
  type MedicamentCandidateRecord,
} from "./ordonnance-medication-candidates.ts";
import { formaterDosePratiqueContextuelle } from "./ordonnance-dose-sources.ts";
import { normaliserConditionnementEnregistre } from "./ordonnance-display.ts";
import type { DosePratiqueContextuelle } from "./ordonnance-types.ts";

export type StatutCorrespondance = "matched" | "ambiguous" | "unmatched" | "manually_confirmed";

export interface MedicamentValidationInput {
  medicationId: string | null;
  createMedication: boolean;
  categoryConfirmed: boolean;
  medicamentNom: string;
  numeroLot: string | null;
  substanceActive: string | null;
  concentration: string | null;
  categorie: string | null;
  familleTherapeutique: string | null;
  formePharmaceutique: string | null;
  conditionnement: string | null;
  voie: string | null;
  doseValue: number | null;
  doseUnit: string | null;
  referenceValue: number | null;
  referenceUnit: string | null;
  referenceType: string | null;
  normalizedDoseValue: number | null;
  normalizedDoseUnit: string | null;
  dosesPratiques?: DosePratiqueContextuelle[];
  administrationCount: number | null;
  administrationIntervalHours: number | null;
  treatmentDurationDays: number | null;
  repeatCondition: string | null;
  administrationInstructions: string | null;
  withdrawalPeriods: { meatDays: number | null; offalDays: number | null; milkDays: number | null };
  precautions: string | null;
  evidence: Record<string, unknown>;
}

export interface OrdonnanceValidationInput {
  prescriptionDate: Date;
  lastVisitDate: Date | null;
  deliveryDate: Date | null;
  ordonnanceNumero: string | null;
  veterinaire: string | null;
  motif: string | null;
  animaux: string | null;
  evidence: Record<string, unknown>;
  medicaments: MedicamentValidationInput[];
}

type MedicamentRecord = MedicamentCandidateRecord;

export interface OrdonnancePersistence {
  medicament: {
    findMany(args: unknown): Promise<MedicamentRecord[]>;
    findUnique(args: unknown): Promise<MedicamentRecord | null>;
    create(args: unknown): Promise<MedicamentRecord>;
  };
  ordonnance: {
    create(args: unknown): Promise<{ id: string }>;
  };
  ordonnanceMedicament: {
    create(args: unknown): Promise<{ id: string }>;
  };
}

export class OrdonnanceValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function normaliserCategorie(value: string | null): string {
  if (!value) return "AUTRE";
  const normalized = normaliserNomMedicament(value).replaceAll(" ", "_");
  return CATEGORIES_MEDICAMENT.find((categorie) =>
    categorie.code === normalized
    || normaliserNomMedicament(categorie.label).replaceAll(" ", "_") === normalized
  )?.code ?? "AUTRE";
}

export function formatPosologieExtraite(med: MedicamentValidationInput): string | null {
  if ((med.dosesPratiques ?? []).length > 0) {
    return med.dosesPratiques!.map(formaterDosePratiqueContextuelle).join("\n");
  }
  if (med.doseValue === null) return null;
  const dose = `${med.doseValue}${med.doseUnit ? ` ${med.doseUnit}` : ""}`;
  if (med.referenceValue === null) return dose;
  return `${dose} / ${med.referenceValue}${med.referenceUnit ? ` ${med.referenceUnit}` : ""}${
    med.referenceType === "live_weight" ? " de poids vif" : ""
  }`;
}

function sourcesEvidence(evidence: Record<string, unknown>): string | null {
  const sources = Object.values(evidence)
    .map((value) => value && typeof value === "object" ? (value as Record<string, unknown>).sourceText : null)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return sources.length > 0 ? sources.join("\n") : null;
}

async function resoudreMedicament(
  tx: OrdonnancePersistence,
  med: MedicamentValidationInput,
): Promise<{ medicament: MedicamentRecord; statut: StatutCorrespondance; score: number | null; candidats: unknown[] }> {
  const candidats = await chargerCandidatsOrdonnance((args) => tx.medicament.findMany(args));
  const correspondances = trouverCorrespondancesMedicaments(med.medicamentNom, med.substanceActive, candidats);
  const matchFort = trouverMedicament(med.medicamentNom, med.substanceActive, candidats);

  if (med.medicationId) {
    const medicament = await tx.medicament.findUnique({ where: { id: med.medicationId } });
    if (!medicament) {
      throw new OrdonnanceValidationError("MEDICAMENT_INTROUVABLE", "La fiche médicament choisie n’existe plus.");
    }
    return {
      medicament,
      statut: matchFort?.id === medicament.id ? "matched" : "manually_confirmed",
      score: correspondances.find((item) => item.id === medicament.id)?.score ?? null,
      candidats: correspondances,
    };
  }

  if (!med.createMedication) {
    const code = correspondances.length > 0 ? "CORRESPONDANCE_AMBIGUE" : "CORRESPONDANCE_REQUISE";
    throw new OrdonnanceValidationError(
      code,
      correspondances.length > 0
        ? "Choisissez la fiche médicament correspondante avant de valider."
        : "Confirmez la création du nouveau médicament avant de valider.",
    );
  }

  if (correspondances.length > 0) {
    throw new OrdonnanceValidationError(
      "MEDICAMENT_POSSIBLE_EXISTANT",
      "Une fiche médicament ressemblante existe. Confirmez-la plutôt que de créer un doublon.",
    );
  }

  const medicament = await tx.medicament.create({
    data: {
      nom: med.medicamentNom.trim(),
      dci: med.substanceActive,
      forme: med.formePharmaceutique,
      categorie: med.categoryConfirmed ? normaliserCategorie(med.categorie) : "AUTRE",
      voie: med.voie,
      delaiAttenteViandeJ: med.withdrawalPeriods.meatDays,
      delaiAttenteLaitJ: med.withdrawalPeriods.milkDays,
    },
  });
  return { medicament, statut: "manually_confirmed", score: null, candidats: [] };
}

export async function creerOrdonnanceAvecMedicaments(
  tx: OrdonnancePersistence,
  finale: OrdonnanceValidationInput,
  pages: string[],
): Promise<{ ordonnanceId: string; medicamentIds: string[] }> {
  if (finale.medicaments.some((med) => med.dosesPratiques?.some((dose) => dose.aVerifier))) {
    throw new OrdonnanceValidationError(
      "DOSE_A_VERIFIER",
      "Corrigez la posologie signalée avant de valider l'ordonnance.",
    );
  }
  const resolus = [];
  for (const med of finale.medicaments) {
    const medSecurise = {
      ...med,
      conditionnement: normaliserConditionnementEnregistre({
        conditionnement: med.conditionnement,
        evidenceJson: JSON.stringify(med.evidence),
      }),
    };
    resolus.push({ med: medSecurise, ...(await resoudreMedicament(tx, medSecurise)) });
  }
  const premier = resolus[0];
  if (!premier) throw new OrdonnanceValidationError("MEDICAMENT_REQUIS", "Au moins un médicament est requis.");

  const ordonnance = await tx.ordonnance.create({
    data: {
      date: finale.prescriptionDate,
      derniereVisite: finale.lastVisitDate,
      dateDelivrance: finale.deliveryDate,
      numero: finale.ordonnanceNumero,
      veterinaireNom: finale.veterinaire,
      medicamentId: premier.medicament.id,
      medicamentNom: premier.medicament.nom,
      substanceActive: premier.med.substanceActive,
      concentration: premier.med.concentration,
      categorieMedicament: premier.medicament.categorie,
      familleTherapeutique: premier.med.familleTherapeutique,
      formePharmaceutique: premier.med.formePharmaceutique,
      conditionnement: premier.med.conditionnement,
      dose: premier.med.doseValue,
      uniteDosage: premier.med.doseUnit,
      referenceValue: premier.med.referenceValue,
      referenceUnit: premier.med.referenceUnit,
      referenceType: premier.med.referenceType,
      normalizedDoseValue: premier.med.normalizedDoseValue,
      normalizedDoseUnit: premier.med.normalizedDoseUnit,
      voie: premier.med.voie,
      frequence: premier.med.administrationInstructions,
      dureeJours: premier.med.treatmentDurationDays,
      administrationCount: premier.med.administrationCount,
      administrationIntervalHours: premier.med.administrationIntervalHours,
      repeatCondition: premier.med.repeatCondition,
      administrationInstructions: premier.med.administrationInstructions,
      motif: finale.motif,
      animaux: finale.animaux,
      delaiAttenteViandeJ: premier.med.withdrawalPeriods.meatDays,
      delaiAttenteAbatsJ: premier.med.withdrawalPeriods.offalDays,
      delaiAttenteLaitJ: premier.med.withdrawalPeriods.milkDays,
      precautions: premier.med.precautions,
      rappels: premier.med.repeatCondition,
      photoUrl: pages[0] ?? null,
      photoUrls: JSON.stringify(pages),
      extractionStructuree: JSON.stringify({ evidence: finale.evidence }),
      statut: "VALIDE",
    },
  });

  for (const item of resolus) {
    await tx.ordonnanceMedicament.create({
      data: {
        ordonnanceId: ordonnance.id,
        medicamentId: item.medicament.id,
        nomExtrait: item.med.medicamentNom,
        numeroLot: item.med.numeroLot,
        substanceActive: item.med.substanceActive,
        concentration: item.med.concentration,
        categorieExtraite: item.med.categorie,
        familleTherapeutique: item.med.familleTherapeutique,
        formePharmaceutique: item.med.formePharmaceutique,
        conditionnement: item.med.conditionnement,
        posologieExtraite: formatPosologieExtraite(item.med),
        dose: item.med.doseValue,
        uniteDosage: item.med.doseUnit,
        referenceValue: item.med.referenceValue,
        referenceUnit: item.med.referenceUnit,
        referenceType: item.med.referenceType,
        normalizedDoseValue: item.med.normalizedDoseValue,
        normalizedDoseUnit: item.med.normalizedDoseUnit,
        voieExtraite: item.med.voie,
        dureeExtraite: item.med.treatmentDurationDays,
        administrationCount: item.med.administrationCount,
        administrationIntervalHours: item.med.administrationIntervalHours,
        repeatCondition: item.med.repeatCondition,
        administrationInstructions: item.med.administrationInstructions,
        delaiAttenteViande: item.med.withdrawalPeriods.meatDays,
        delaiAttenteAbats: item.med.withdrawalPeriods.offalDays,
        delaiAttenteLait: item.med.withdrawalPeriods.milkDays,
        precautions: item.med.precautions,
        texteSource: sourcesEvidence(item.med.evidence),
        evidenceJson: JSON.stringify({ ...item.med.evidence, dosesPratiques: item.med.dosesPratiques ?? [] }),
        candidatsJson: JSON.stringify(item.candidats),
        scoreCorrespondance: item.score,
        statutCorrespondance: item.statut,
      },
    });
  }

  return { ordonnanceId: ordonnance.id, medicamentIds: resolus.map((item) => item.medicament.id) };
}

import { CATEGORIES_MEDICAMENT, getCategorieMedicament } from "./medicament-categories.ts";
import { analyserPresentation } from "./ordonnance-display.ts";
import {
  normaliserNomMedicament,
  trouverCorrespondancesMedicaments,
} from "./ordonnance-extraction.ts";
import {
  chargerCandidatsOrdonnance,
  type MedicamentCandidateRecord,
} from "./ordonnance-medication-candidates.ts";
import type { MedicamentCorrespondant } from "./ordonnance-types.ts";

export interface CreationPharmacieInput {
  confirmed: boolean;
  categoryConfirmed: boolean;
  medicamentNom: string;
  conditionnement: string | null;
  formePharmaceutique: string | null;
  voie: string | null;
  substanceActive: string | null;
  concentration: string | null;
  categorie: string | null;
  doseValue: number | null;
  doseUnit: string | null;
  referenceValue: number | null;
  referenceUnit: string | null;
  referenceType: string | null;
  administrationCount: number | null;
  treatmentDurationDays: number | null;
  administrationIntervalHours: number | null;
  repeatCondition: string | null;
  meatDays: number | null;
  offalDays: number | null;
  milkDays: number | null;
  precautions: string | null;
}

export interface CreationPharmaciePersistence {
  medicament: {
    findMany(args: unknown): Promise<MedicamentCandidateRecord[]>;
    create(args: unknown): Promise<MedicamentCandidateRecord>;
  };
  conditionnementMedicament: {
    create(args: unknown): Promise<unknown>;
  };
  preconisation: {
    create(args: unknown): Promise<unknown>;
  };
}

export class CreationPharmacieError extends Error {
  readonly code: "CONFIRMATION_REQUISE" | "NOM_REQUIS" | "DOUBLON_POSSIBLE";
  readonly candidats: MedicamentCorrespondant[];

  constructor(
    code: "CONFIRMATION_REQUISE" | "NOM_REQUIS" | "DOUBLON_POSSIBLE",
    message: string,
    candidats: MedicamentCorrespondant[] = [],
  ) {
    super(message);
    this.code = code;
    this.candidats = candidats;
  }
}

function categorie(value: string | null, confirmed: boolean): string {
  if (!confirmed || !value) return "AUTRE";
  const normalized = normaliserNomMedicament(value).replaceAll(" ", "_");
  return CATEGORIES_MEDICAMENT.find((item) =>
    item.code === normalized
    || normaliserNomMedicament(item.label).replaceAll(" ", "_") === normalized
  )?.code ?? "AUTRE";
}

function doseBase(input: CreationPharmacieInput): string | null {
  if (input.referenceType === "animal") return "ANIMAL";
  if (input.referenceUnit?.toLowerCase() !== "kg") return null;
  if (input.referenceValue === 100) return "100KG";
  if (input.referenceValue === 1) return "KG";
  return input.referenceValue ? `${input.referenceValue} KG` : "KG";
}

function frequence(input: CreationPharmacieInput): string | null {
  const elements = [
    input.administrationCount ? `${input.administrationCount} administration${input.administrationCount > 1 ? "s" : ""}` : null,
    input.treatmentDurationDays ? `${input.treatmentDurationDays} jour${input.treatmentDurationDays > 1 ? "s" : ""}` : null,
    input.administrationIntervalHours ? `intervalle ${input.administrationIntervalHours} h` : null,
    input.repeatCondition,
  ].filter(Boolean);
  return elements.length > 0 ? elements.join(" · ") : null;
}

function commentaire(input: CreationPharmacieInput): string | null {
  const elements = [
    input.concentration ? `Concentration extraite : ${input.concentration}` : null,
    input.offalDays !== null ? `Délai abats extrait : ${input.offalDays} j` : null,
    input.conditionnement ? `Présentation extraite : ${input.conditionnement}` : null,
  ].filter(Boolean);
  return elements.length > 0 ? elements.join("\n") : null;
}

function versCorrespondant(medicament: MedicamentCandidateRecord): MedicamentCorrespondant {
  return {
    id: medicament.id,
    nom: medicament.nom,
    dci: medicament.dci,
    forme: medicament.forme,
    categorie: medicament.categorie,
    categorieLabel: getCategorieMedicament(medicament.categorie).label,
    voie: medicament.voie,
    delaiAttenteViandeJ: medicament.delaiAttenteViandeJ,
    delaiAttenteLaitJ: medicament.delaiAttenteLaitJ,
    dosagePourKg: medicament.dosagePourKg ?? null,
    uniteDosage: medicament.uniteDosage ?? null,
    preconisations: medicament.preconisations ?? [],
    conditionnements: medicament.conditionnements ?? [],
    actif: medicament.actif !== false,
    score: 1,
    concordances: [],
    divergences: [],
  };
}

export async function creerMedicamentPharmacieDepuisOrdonnance(
  tx: CreationPharmaciePersistence,
  input: CreationPharmacieInput,
): Promise<{ medicament: MedicamentCorrespondant; preconisationCreee: boolean }> {
  if (!input.confirmed) {
    throw new CreationPharmacieError("CONFIRMATION_REQUISE", "Confirmez la création de la fiche Pharmacie.");
  }
  const nom = input.medicamentNom.trim();
  if (!nom) throw new CreationPharmacieError("NOM_REQUIS", "Le nom du médicament est requis.");

  const candidats = await chargerCandidatsOrdonnance((args) => tx.medicament.findMany(args));
  const correspondances = trouverCorrespondancesMedicaments(nom, input.substanceActive, candidats);
  if (correspondances.length > 0) {
    throw new CreationPharmacieError(
      "DOUBLON_POSSIBLE",
      "Une fiche Pharmacie ressemblante existe déjà. Associez-la au lieu de créer un doublon.",
      correspondances,
    );
  }

  const presentation = analyserPresentation(input.conditionnement);
  const volume = presentation.presentation?.match(/\b(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b/i) ?? null;
  const categorieCode = categorie(input.categorie, input.categoryConfirmed);
  const created = await tx.medicament.create({
    data: {
      nom,
      dci: input.substanceActive,
      forme: input.formePharmaceutique,
      categorie: categorieCode,
      voie: input.voie,
      delaiAttenteViandeJ: input.meatDays,
      delaiAttenteLaitJ: input.milkDays,
      commentaire: commentaire(input),
      actif: true,
    },
  });

  if (volume) {
    await tx.conditionnementMedicament.create({
      data: {
        medicamentId: created.id,
        quantiteFlacon: Number(volume[1].replace(",", ".")),
        uniteFlacon: volume[2].toLowerCase(),
        actif: true,
      },
    });
  }

  const preconisationCreee = input.doseValue !== null;
  if (preconisationCreee) {
    await tx.preconisation.create({
      data: {
        medicamentId: created.id,
        dose: input.doseValue,
        unite: input.doseUnit,
        doseBase: doseBase(input),
        voie: input.voie,
        frequence: frequence(input),
        dureeValeur: input.treatmentDurationDays,
        dureeUnite: input.treatmentDurationDays ? "JOUR" : null,
        nombreAdministrations: input.administrationCount,
        precautions: input.precautions,
        delaiAttenteViandeJ: input.meatDays,
        delaiAttenteLaitTraites: null,
        source: "ORDONNANCE_OCR",
        statut: "A_VERIFIER",
        commentaireVerification: "Préconisation proposée depuis une ordonnance ; à confirmer dans Pharmacie.",
      },
    });
  }

  return {
    medicament: versCorrespondant({
      ...created,
      categorie: categorieCode,
      actif: true,
      preconisations: preconisationCreee ? [{
        dose: input.doseValue,
        unite: input.doseUnit,
        doseBase: doseBase(input),
        voie: input.voie,
        frequence: frequence(input),
        delaiAttenteViandeJ: input.meatDays,
        delaiAttenteLaitTraites: null,
        statut: "A_VERIFIER",
      }] : [],
      conditionnements: volume
        ? [{ quantiteFlacon: Number(volume[1].replace(",", ".")), uniteFlacon: volume[2].toLowerCase() }]
        : [],
    }),
    preconisationCreee,
  };
}

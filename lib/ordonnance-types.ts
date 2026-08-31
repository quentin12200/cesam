export interface ChampExtrait<T> {
  value: T;
  sourceText: string | null;
  confidence: number;
  zone?: string | null;
}

export interface PeriodesAttente {
  meatDays: number | null;
  offalDays: number | null;
  milkDays: number | null;
}

export interface DoseOrdonnanceSource {
  doseValue: string;
  doseUnit: string;
  referenceValue: string;
  referenceUnit: string;
  referenceType: string;
  sourceText: string | null;
}

export interface DosePratiqueContextuelle {
  categorieAnimaux: string | null;
  doseValue: string;
  doseUnit: string;
  poidsMinKg: string | null;
  poidsMaxKg: string | null;
  frequence: string | null;
  maximum: boolean;
  origine: "ordonnance" | "calculee" | "manuelle";
  sourceText: string | null;
  aVerifier: boolean;
}

export interface ConditionImportanteOrdonnance {
  type: string;
  value: string;
  sourceText: string;
  confidence: number;
}

export interface PreconisationPharmacieControle {
  dose: number | null;
  unite: string | null;
  doseBase: string | null;
  voie: string | null;
  frequence: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitTraites: number | null;
  statut: string;
}

export interface MedicamentCorrespondant {
  id: string;
  nom: string;
  dci: string | null;
  forme: string | null;
  categorie: string;
  categorieLabel: string;
  voie: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  dosagePourKg?: number | null;
  uniteDosage?: string | null;
  preconisations?: PreconisationPharmacieControle[];
  conditionnements?: Array<{ quantiteFlacon: number | null; uniteFlacon: string | null }>;
  actif?: boolean;
  score: number;
  concordances: string[];
  divergences: string[];
}

export interface MedicamentPropose {
  medicamentNom: string | null;
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
  referenceType: "live_weight" | "animal" | null;
  normalizedDoseValue: number | null;
  normalizedDoseUnit: string | null;
  dosePratique?: DoseOrdonnanceSource | null;
  dosesPratiques?: DosePratiqueContextuelle[];
  dosePharmacologique?: DoseOrdonnanceSource | null;
  doseSourceConflict?: boolean;
  administrationCount: number | null;
  administrationIntervalHours: number | null;
  treatmentDurationDays: number | null;
  repeatCondition: string | null;
  administrationInstructions: string | null;
  withdrawalPeriods: PeriodesAttente;
  precautions: string | null;
  conditionsImportantes: ConditionImportanteOrdonnance[];
  medicationMatch: MedicamentCorrespondant | null;
  medicationMatches: MedicamentCorrespondant[];
  medicationMatchStatus: "matched" | "ambiguous" | "unmatched" | "manually_confirmed";
  evidence: Record<string, ChampExtrait<unknown>>;

  // Compatibilite avec les brouillons crees avant l'extraction structuree.
  dose?: number | null;
  uniteDosage?: string | null;
  frequence?: string | null;
  dureeJours?: number | null;
  delaiAttenteViandeJ?: number | null;
  delaiAttenteLaitJ?: number | null;
  rappels?: string | null;
}

export interface PropositionOrdonnance {
  prescriptionDate?: string | null;
  lastVisitDate?: string | null;
  deliveryDate?: string | null;
  ordonnanceNumero?: string | null;
  veterinaire?: string | null;
  motif?: string | null;
  medicaments?: MedicamentPropose[];
  evidence?: Record<string, ChampExtrait<unknown>>;

  // Compatibilite avec les anciens brouillons.
  dateDebut?: string | null;
  medicamentNom?: string | null;
  voie?: string | null;
  dose?: number | null;
  uniteDosage?: string | null;
  frequence?: string | null;
  dureeJours?: number | null;
  delaiAttenteViandeJ?: number | null;
  delaiAttenteLaitJ?: number | null;
  precautions?: string | null;
  rappels?: string | null;
}

export function medicamentVide(): MedicamentPropose {
  return {
    medicamentNom: null,
    numeroLot: null,
    substanceActive: null,
    concentration: null,
    categorie: null,
    familleTherapeutique: null,
    formePharmaceutique: null,
    conditionnement: null,
    voie: null,
    doseValue: null,
    doseUnit: null,
    referenceValue: null,
    referenceUnit: null,
    referenceType: null,
    normalizedDoseValue: null,
    normalizedDoseUnit: null,
    dosesPratiques: [],
    administrationCount: null,
    administrationIntervalHours: null,
    treatmentDurationDays: null,
    repeatCondition: null,
    administrationInstructions: null,
    withdrawalPeriods: { meatDays: null, offalDays: null, milkDays: null },
    precautions: null,
    conditionsImportantes: [],
    medicationMatch: null,
    medicationMatches: [],
    medicationMatchStatus: "unmatched",
    evidence: {},
  };
}

export function medicamentsDepuisProposition(prop: PropositionOrdonnance | null | undefined): MedicamentPropose[] {
  if (!prop || typeof prop !== "object") return [medicamentVide()];
  if (Array.isArray(prop.medicaments) && prop.medicaments.length > 0) {
    return prop.medicaments.map((m) => {
      const medicationMatches = Array.isArray(m.medicationMatches)
        ? m.medicationMatches
        : m.medicationMatch ? [m.medicationMatch] : [];
      return {
        ...medicamentVide(),
        ...m,
        medicationMatches,
        medicationMatchStatus: m.medicationMatchStatus
          ?? (m.medicationMatch ? "matched" : medicationMatches.length > 0 ? "ambiguous" : "unmatched"),
        doseValue: m.doseValue ?? m.dose ?? null,
        doseUnit: m.doseUnit ?? m.uniteDosage ?? null,
        treatmentDurationDays: m.treatmentDurationDays ?? m.dureeJours ?? null,
        withdrawalPeriods: {
          meatDays: m.withdrawalPeriods?.meatDays ?? m.delaiAttenteViandeJ ?? null,
          offalDays: m.withdrawalPeriods?.offalDays ?? m.delaiAttenteViandeJ ?? null,
          milkDays: m.withdrawalPeriods?.milkDays ?? m.delaiAttenteLaitJ ?? null,
        },
      };
    });
  }
  return [{
    ...medicamentVide(),
    medicamentNom: prop.medicamentNom ?? null,
    voie: prop.voie ?? null,
    doseValue: prop.dose ?? null,
    doseUnit: prop.uniteDosage ?? null,
    treatmentDurationDays: prop.dureeJours ?? null,
    withdrawalPeriods: {
      meatDays: prop.delaiAttenteViandeJ ?? null,
      offalDays: prop.delaiAttenteViandeJ ?? null,
      milkDays: prop.delaiAttenteLaitJ ?? null,
    },
    precautions: prop.precautions ?? null,
    administrationInstructions: prop.frequence ?? null,
    repeatCondition: prop.rappels ?? null,
  }];
}

export function parseDocumentUrls(documentUrls: string | null | undefined, documentUrl: string): string[] {
  if (documentUrls) {
    try {
      const parsed = JSON.parse(documentUrls);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((u): u is string => typeof u === "string");
      }
    } catch {
      // Repli sur l'URL historique unique.
    }
  }
  return documentUrl ? [documentUrl] : [];
}

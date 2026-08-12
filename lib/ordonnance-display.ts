import {
  formaterDoseSource,
  resoudreSourcesDose,
  type DoseSourceStructuree,
  type ResolutionSourcesDose,
} from "./ordonnance-dose-sources.ts";
import type { MedicamentCorrespondant } from "./ordonnance-types.ts";

export { resoudreSourcesDose } from "./ordonnance-dose-sources.ts";
export type { DoseSourceStructuree, ResolutionSourcesDose } from "./ordonnance-dose-sources.ts";

const VOIES: Record<string, string> = {
  IM: "Intramusculaire",
  INTRAMUSCULAIRE: "Intramusculaire",
  SC: "Sous-cutanée",
  SOUSCUTANEE: "Sous-cutanée",
  IV: "Intraveineuse",
  INTRAVEINEUSE: "Intraveineuse",
  PO: "Voie orale",
  ORALE: "Voie orale",
  CUTANEE: "Voie cutanée",
  INTRAMAMMAIRE: "Intramammaire",
};

function sansAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function formaterVoie(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const cle = sansAccents(value).toUpperCase().replace(/[^A-Z]+/g, "");
  return VOIES[cle] ?? value.trim();
}

export interface PresentationDelivree {
  presentation: string | null;
  quantite: number | null;
}

export function analyserPresentation(value: string | null | undefined): PresentationDelivree {
  if (!value?.trim()) return { presentation: null, quantite: null };
  const nettoye = value.trim().replace(/\s+/g, " ");
  const match = nettoye.match(/^(\d+)\s*[x×]?\s*(.+)$/i);
  const quantite = match ? Number(match[1]) : null;
  let presentation = (match?.[2] ?? nettoye).trim();
  presentation = presentation
    .replace(/^fl\.?(?:\s+|$)/i, "flacon ")
    .replace(/^aer\.?(?:\s+|$)/i, "aérosol ")
    .replace(/^(flacons?|a[ée]rosols?|ampoules?|bo[iî]tes?)\s+(?=\d)/i, "$1 de ")
    .replace(/\s+/g, " ")
    .trim();
  return { presentation: presentation || null, quantite: Number.isFinite(quantite) ? quantite : null };
}

export function formaterPresentationCompacte(value: string | null | undefined): string | null {
  const { presentation, quantite } = analyserPresentation(value);
  const libelle = presentation
    ?.replace(/^(flacons?|a[ée]rosols?|ampoules?|bo[iî]tes?)\s+de\s+(?=\d)/i, "$1 ")
    .replace(/^./, (premiereLettre) => premiereLettre.toUpperCase());
  return [libelle, quantite !== null ? `Qté ${quantite}` : null].filter(Boolean).join(" · ") || null;
}

export function formaterDose(med: {
  doseValue: string;
  doseUnit: string;
  referenceValue: string;
  referenceUnit: string;
  referenceType: string;
}): string | null {
  if (!med.doseValue || !med.doseUnit) return null;
  const base = `${med.doseValue} ${med.doseUnit}`;
  if (!med.referenceValue || !med.referenceUnit) return base;
  return `${base} pour ${med.referenceValue} ${med.referenceUnit}${med.referenceType === "live_weight" ? " de poids vif" : ""}`;
}

export function formaterDoseCompacte(med: {
  doseValue: string;
  doseUnit: string;
  referenceValue: string;
  referenceUnit: string;
  referenceType: string;
  formePharmaceutique?: string;
  conditionnement?: string;
  doseSourceText?: string | null;
  preferStructuredDose?: boolean;
  dosePratique?: DoseSourceStructuree | null;
  dosePharmacologique?: DoseSourceStructuree | null;
}): string | null {
  const resolution = resoudreSourcesDose({
    ...med,
    correctionManuelle: med.preferStructuredDose,
  });
  return formaterDoseSource(resolution.doseAffichee);
}

interface DoseStructuree {
  doseValue: string;
  doseUnit: string;
  referenceValue: string;
  referenceUnit: string;
  referenceType: string;
}

export function resoudreDosePratique(med: DoseStructuree & {
  formePharmaceutique?: string;
  conditionnement?: string;
  doseSourceText?: string | null;
}): DoseStructuree | null {
  const dose = resoudreSourcesDose(med).dosePratique;
  if (!dose) return null;
  return {
    doseValue: dose.doseValue,
    doseUnit: dose.doseUnit,
    referenceValue: dose.referenceValue,
    referenceUnit: dose.referenceUnit,
    referenceType: dose.referenceType,
  };
}

export function controlerCoherenceDosePharmacie(
  resolution: ResolutionSourcesDose,
  match: MedicamentCorrespondant | null | undefined,
): { avertissement: boolean; detail: string | null } {
  const sourcesOcrSeparees = Boolean(
    resolution.dosePratique?.sourceText && resolution.dosePharmacologique?.sourceText,
  );
  if (resolution.sourceHybrideDetectee && !sourcesOcrSeparees) {
    return {
      avertissement: true,
      detail: "Les éléments de dose ne peuvent pas être rattachés avec certitude à une même expression OCR.",
    };
  }

  const pratique = resolution.dosePratique;
  if (!pratique || !pratique.referenceValue || pratique.referenceUnit.toLowerCase() !== "kg") {
    return { avertissement: false, detail: null };
  }
  const valeurOrdonnance = Number(pratique.doseValue.replace(",", "."));
  const baseOrdonnance = Number(pratique.referenceValue.replace(",", "."));
  if (!Number.isFinite(valeurOrdonnance) || !Number.isFinite(baseOrdonnance) || baseOrdonnance <= 0) {
    return { avertissement: false, detail: null };
  }

  const preconisationsComparables = (match?.preconisations ?? []).flatMap((preconisation) => {
    if (preconisation.statut !== "VALIDE" || preconisation.dose == null || !preconisation.unite) return [];
    if (sansAccents(preconisation.unite).toLowerCase() !== sansAccents(pratique.doseUnit).toLowerCase()) return [];
    const base = preconisation.doseBase?.match(/(\d+(?:[.,]\d+)?)\s*kg/i)?.[1];
    const baseKg = base ? Number(base.replace(",", ".")) : null;
    if (!baseKg || !Number.isFinite(baseKg)) return [];
    return [{ dose: preconisation.dose, baseKg }];
  });
  if (preconisationsComparables.length !== 1) return { avertissement: false, detail: null };

  const ordonnanceParKg = valeurOrdonnance / baseOrdonnance;
  const pharmacieParKg = preconisationsComparables[0].dose / preconisationsComparables[0].baseKg;
  const equivalentes = Math.abs(ordonnanceParKg - pharmacieParKg) <= 1e-9;
  return equivalentes
    ? { avertissement: false, detail: null }
    : {
      avertissement: true,
      detail: "La dose pratique de l’ordonnance diffère de la préconisation validée de la fiche Pharmacie. La prescription n’a pas été modifiée.",
    };
}

export function estInstructionPratique(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const normalized = sansAccents(value).toLowerCase();
  return /\b(agiter|vertical|debout|nettoyer|parage|ponction|seringue|flacon|application|desinfecter|aiguille)\b/.test(normalized);
}

export function formaterRythme(med: {
  administrationCount: string;
  administrationInstructions: string;
}): string | null {
  if (med.administrationCount === "1") return "Injection unique";
  if (med.administrationCount) return `${med.administrationCount} injections`;
  const instructions = med.administrationInstructions.trim();
  if (instructions && !estInstructionPratique(instructions) && instructions.length <= 60) return instructions;
  return null;
}

export function formaterRenouvellement(med: {
  administrationIntervalHours: string;
  repeatCondition: string;
}): string | null {
  if (!med.administrationIntervalHours && !med.repeatCondition) return null;
  const condition = med.repeatCondition.trim();
  if (med.administrationIntervalHours) {
    const intervalleDejaPresent = new RegExp(`apres\\s+${med.administrationIntervalHours}\\s*(?:h|heure)`, "i")
      .test(sansAccents(condition));
    if (intervalleDejaPresent) return condition;
    return condition
      ? `Renouvelable après ${med.administrationIntervalHours} h ${condition}`
      : `Renouvelable après ${med.administrationIntervalHours} h`;
  }
  return condition || null;
}

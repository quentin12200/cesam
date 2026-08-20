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

function uniteVolume(value: string): string {
  const unite = sansAccents(value).toLowerCase();
  return /^m(?:l|i|1)$/.test(unite) ? "ml" : unite;
}

interface PresentationVeterinaire {
  libelle: string;
  quantitePrefixe: number | null;
  score: number;
}

function libelleDoses(value: string): string {
  return `${value} dose${Number(value) > 1 ? "s" : ""}`;
}

function extrairePresentationVeterinaire(value: string): PresentationVeterinaire | null {
  const texte = sansAccents(value).replace(/\s+/g, " ").trim();
  if (!texte) return null;
  const quantitePrefixeMatch = texte.match(
    /^\s*(\d+)\s*[x×]?\s*(?=(?:fl(?:acon)?|ser(?:ingue)?|amp(?:oule)?|aer(?:osol)?|presentoir|bt|boite)s?\b)/i,
  );
  const quantitePrefixe = quantitePrefixeMatch ? Number(quantitePrefixeMatch[1]) : null;
  const boite = texte.match(/\b(?:bt|boite)s?\.?\s*(?:de\s*)?(\d+)\s*d(?:\.|oses?)?\b/i);
  const contenantVolume = texte.match(
    /\b(fl(?:acon)?|ser(?:ingue)?|amp(?:oule)?|aer(?:osol)?|presentoir)s?\.?\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(m(?:l|i|1)|cl|l)\b(?:\s*[·-]?\s*\(?\s*(\d+)\s*d(?:\.|oses?)?\s*\)?)?/i,
  );

  const parties: string[] = [];
  if (boite) parties.push(`boîte de ${libelleDoses(boite[1])}`);
  if (contenantVolume) {
    const noms: Record<string, string> = {
      fl: "flacon",
      flacon: "flacon",
      ser: "seringue",
      seringue: "seringue",
      amp: "ampoule",
      ampoule: "ampoule",
      aer: "aérosol",
      aerosol: "aérosol",
      presentoir: "présentoir",
    };
    const contenant = noms[contenantVolume[1].toLowerCase()];
    const volume = `${contenantVolume[2].replace(",", ".")} ${uniteVolume(contenantVolume[3])}`;
    parties.push(`${contenant} de ${volume}${contenantVolume[4] ? ` · ${libelleDoses(contenantVolume[4])}` : ""}`);
  }

  if (parties.length === 0) return null;
  return {
    libelle: parties.join(" · "),
    quantitePrefixe,
    score: (boite ? 1 : 0) + (contenantVolume ? 2 : 0) + (contenantVolume?.[4] ? 1 : 0),
  };
}

function quantiteExplicite(value: string): number | null {
  const match = value.match(/\b(?:qt[eé]|quantit[eé])\s*[:=]?\s*(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function quantiteStructuree(presentation: Record<string, unknown> | null | undefined): number | null {
  const value = presentation?.deliveredQuantity;
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : null;
  return parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normaliserConditionnementExtrait({
  conditionnement,
  presentation,
  sourceTexts = [],
}: {
  conditionnement: string | null;
  presentation?: Record<string, unknown> | null;
  sourceTexts?: string[];
}): string | null {
  const textes = [
    conditionnement,
    typeof presentation?.sourceText === "string" ? presentation.sourceText : null,
    ...sourceTexts,
  ].filter((value): value is string => Boolean(value?.trim()));
  const presentationStructuree = typeof presentation?.containerType === "string"
    && typeof presentation?.volumeValue === "number"
    && typeof presentation?.volumeUnit === "string"
    ? extrairePresentationVeterinaire(
      `${presentation.containerType} ${presentation.volumeValue} ${presentation.volumeUnit}`,
    )
    : null;
  const presentationsTexte = textes
    .map(extrairePresentationVeterinaire)
    .filter((value): value is PresentationVeterinaire => value !== null);
  const presentationTrouvee = [presentationStructuree, ...presentationsTexte]
    .filter((value): value is PresentationVeterinaire => value !== null)
    .sort((left, right) => right.score - left.score)[0] ?? null;
  const quantiteStructure = quantiteStructuree(presentation);
  const quantiteHorsConditionnement = sourceTexts
    .map(quantiteExplicite)
    .find((value) => value !== null) ?? null;
  const quantiteTrouvee = quantiteStructure
    ?? textes.map(quantiteExplicite).find((value) => value !== null)
    ?? (() => {
      return presentationsTexte.map((value) => value.quantitePrefixe).find((value) => value !== null) ?? null;
    })();

  if (!presentationTrouvee) return conditionnement?.trim() || null;
  if (
    conditionnement
    && quantiteTrouvee === null
    && /^(?:flacon|a[ée]rosol|ampoule|bo[iî]te|seringue|pr[ée]sentoir)\s+\d/i.test(conditionnement.trim())
  ) {
    return conditionnement.trim();
  }
  return quantiteTrouvee !== null
    ? `${quantiteTrouvee} ${presentationTrouvee.libelle}`
    : presentationTrouvee.libelle;
}

export function normaliserConditionnementEnregistre({
  conditionnement,
  evidenceJson,
}: {
  conditionnement: string | null;
  evidenceJson: string | null;
}): string | null {
  if (!evidenceJson) return normaliserConditionnementExtrait({ conditionnement });
  try {
    const evidence = JSON.parse(evidenceJson) as Record<string, unknown>;
    const presentationBrute = evidence.presentation;
    const presentationChamp = presentationBrute && typeof presentationBrute === "object"
      ? presentationBrute as Record<string, unknown>
      : {};
    const presentationValue = presentationChamp.value && typeof presentationChamp.value === "object"
      ? presentationChamp.value as Record<string, unknown>
      : presentationChamp;
    const quantiteChamp = evidence.deliveredQuantity && typeof evidence.deliveredQuantity === "object"
      ? evidence.deliveredQuantity as Record<string, unknown>
      : {};
    const presentation = {
      ...presentationValue,
      ...(presentationValue.deliveredQuantity == null && quantiteChamp.value != null
        ? { deliveredQuantity: quantiteChamp.value }
        : {}),
    };
    const sourceTexts = [evidence.conditionnement, evidence.presentation, evidence.deliveredQuantity]
      .flatMap((champ) => {
        if (!champ || typeof champ !== "object") return [];
        const sourceText = (champ as Record<string, unknown>).sourceText;
        return typeof sourceText === "string" ? [sourceText] : [];
      });
    return normaliserConditionnementExtrait({ conditionnement, presentation, sourceTexts });
  } catch {
    return normaliserConditionnementExtrait({ conditionnement });
  }
}

export function analyserPresentation(value: string | null | undefined): PresentationDelivree {
  if (!value?.trim()) return { presentation: null, quantite: null };
  const nettoye = value.trim().replace(/\s+/g, " ");
  const quantiteSuffixe = quantiteExplicite(nettoye);
  const match = nettoye.match(/^(\d+)\s*[x×]?\s*((?:fl\.?|flacons?|aer\.?|a[ée]rosols?|amp\.?|ampoules?|bt\.?|bo[iî]tes?|ser\.?|seringues?|pr[ée]sentoirs?)\b.*)$/i);
  const quantite = quantiteSuffixe ?? (match ? Number(match[1]) : null);
  let presentation = (match?.[2] ?? nettoye)
    .replace(/\s*[·-]?\s*(?:qt[eé]|quantit[eé])\s*[:=]?\s*\d+\s*$/i, "")
    .trim();
  presentation = presentation
    .replace(/^fl\.?(?:\s+|$)/i, "flacon ")
    .replace(/^aer\.?(?:\s+|$)/i, "aérosol ")
    .replace(/^ser\.?(?:\s+|$)/i, "seringue ")
    .replace(/^presentoir\.?(?:\s+|$)/i, "présentoir ")
    .replace(/^(flacons?|a[ée]rosols?|ampoules?|bo[iî]tes?|seringues?|pr[ée]sentoirs?)\s+(?=\d)/i, "$1 de ")
    .replace(/\s+/g, " ")
    .trim();
  return { presentation: presentation || null, quantite: Number.isFinite(quantite) ? quantite : null };
}

export function formaterMedicamentPourListe({
  nomExtrait,
  conditionnement,
}: {
  nomExtrait: string;
  conditionnement?: string | null;
}): { nom: string; presentation: string | null; quantite: number | null } {
  const { presentation, quantite } = analyserPresentation(conditionnement);
  const nom = nomExtrait
    .trim()
    .replace(
      /\s+(?:(?:\d+\s*)?(?:fl(?:acon)?|ser(?:ingue)?|pr[ée]sentoir|bt|bo[iî]te|aer|a[ée]rosol|amp(?:oule)?)\.?\s*(?:de\s*)?\d+(?:[.,]\d+)?\s*(?:ml|cl|l|d(?:\.|oses?)?)(?:\s*[·-]?\s*\(?\s*\d+\s*d(?:\.|oses?)?\s*\)?)?)(?:\s*[·-]?\s*(?:qt[ée]|quantit[ée])\s*:?\s*\d+)?\s*$/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
  const presentationLisible = presentation
    ?.replace(/^flacons?\s+de\s+(?=\d)/i, "flacon ")
    .replace(/^a[ée]rosols?\s+de\s+(?=\d)/i, "aérosol ")
    .replace(/^ampoules?\s+de\s+(?=\d)/i, "ampoule ")
    .replace(/^bo[iî]tes?\s+de\s+(?=\d+\s*(?:ml|cl|l)\b)/i, "boîte ")
    .replace(/^bo[iî]tes?\s+de\s+/i, "boîte de ")
    .replace(/^seringues?\s+de\s+(?=\d)/i, "seringue ")
    .replace(/^pr[ée]sentoirs?\s+de\s+(?=\d)/i, "présentoir ")
    .replace(/^./, (premiereLettre) => premiereLettre.toUpperCase())
    ?? null;

  return { nom: nom || nomExtrait.trim(), presentation: presentationLisible, quantite };
}

export function formaterPresentationCompacte(value: string | null | undefined): string | null {
  const boiteDoses = value?.trim().match(
    /^(?:bt|bo[iî]te)\.?\s+(\d+)\s*d(?:\.|oses?)?(?:\s+de\s+(\d+(?:[.,]\d+)?)\s*(ml|cl|l))?\.?$/i,
  );
  if (boiteDoses) {
    const volumeDose = boiteDoses[2]
      ? ` de ${boiteDoses[2].replace(",", ".")} ${boiteDoses[3].toLowerCase()}`
      : "";
    return `Boîte de ${boiteDoses[1]} doses${volumeDose}`;
  }

  const { presentation, quantite } = analyserPresentation(value);
  const libelle = presentation
    ?.replace(/^(flacons?|a[ée]rosols?|ampoules?)\s+de\s+(?=\d)/i, "$1 ")
    .replace(/^bo[iî]tes?\s+de\s+(?=\d+\s*(?:ml|cl|l)\b)/i, "boîte ")
    .replace(/^bo[iî]tes?\s+de\s+/i, "boîte de ")
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
  const condition = normaliserConditionRenouvellement(med.repeatCondition);
  if (sansAccents(condition).toLowerCase() === "renouvellement interdit") {
    return "Renouvellement interdit";
  }
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

export function formaterRenouvellementUtile(med: {
  administrationIntervalHours: string;
  repeatCondition: string;
}): string | null {
  const renouvellement = formaterRenouvellement(med);
  return renouvellement && sansAccents(renouvellement).toLowerCase() !== "renouvellement interdit"
    ? renouvellement
    : null;
}

export function normaliserConditionRenouvellement(value: string | null | undefined): string {
  const condition = value?.trim() ?? "";
  if (!condition) return "";
  const sansAccent = sansAccents(condition).toLowerCase();
  if (/\bsi\s+necessaire\b/.test(sansAccent)) return "si nécessaire";
  if (/\bsi\s+besoin\b/.test(sansAccent)) return "si besoin";
  if (/\bsi\s+(?:les\s+)?signes?\s+persist(?:e|ent)\b/.test(sansAccent)) {
    return "si les signes persistent";
  }
  if (/\ben\s+cas\s+de\b/.test(sansAccent)) {
    const debut = sansAccent.indexOf("en cas de");
    return condition.slice(debut).trim();
  }
  // Une phrase contenant une dose ou la description d'une administration
  // n'est pas une condition de renouvellement exploitable.
  if (/\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|ml|cl|g|kg)\b/i.test(condition)
    || /\b(?:administration|injection|dose)\b/i.test(sansAccent)) return "";
  return condition.length <= 60 ? condition : "";
}

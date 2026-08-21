import {
  formaterDoseSource,
  resoudreSourcesDose,
  type DoseSourceStructuree,
  type ResolutionSourcesDose,
} from "./ordonnance-dose-sources.ts";
import type { MedicamentCorrespondant } from "./ordonnance-types.ts";
import {
  conditionnementCanonique,
  extraireConditionnementDepuisTexte,
  resoudreConditionnementStructure,
} from "./ordonnance-packaging.ts";

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

export interface ConditionnementVisuel {
  ligne: string | null;
  totalDoses: string | null;
}

interface PresentationVeterinaire {
  libelle: string;
  quantitePrefixe: number | null;
  score: number;
}

function extrairePresentationVeterinaire(value: string): PresentationVeterinaire | null {
  const structure = extraireConditionnementDepuisTexte(value);
  if (!structure || structure.needsVerification) return null;
  const canonique = conditionnementCanonique({ ...structure, deliveredQuantity: null });
  if (!canonique) return null;
  return {
    libelle: canonique,
    quantitePrefixe: structure.deliveredQuantity,
    score: 1 + (structure.contentValue !== null ? 2 : 0) + (structure.dosesPerContainer !== null ? 1 : 0),
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

function collecterValeursParCle(value: unknown, cleRecherchee: string, resultat: unknown[] = []): unknown[] {
  if (!value || typeof value !== "object") return resultat;
  if (Array.isArray(value)) {
    for (const item of value) collecterValeursParCle(item, cleRecherchee, resultat);
    return resultat;
  }
  for (const [cle, enfant] of Object.entries(value as Record<string, unknown>)) {
    if (cle === cleRecherchee) resultat.push(enfant);
    collecterValeursParCle(enfant, cleRecherchee, resultat);
  }
  return resultat;
}

function collecterTextesSources(value: unknown): string[] {
  return collecterValeursParCle(value, "sourceText")
    .filter((sourceText): sourceText is string => typeof sourceText === "string" && sourceText.trim().length > 0);
}

function objetStructure(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const objet = value as Record<string, unknown>;
  return objet.value && typeof objet.value === "object" && !Array.isArray(objet.value)
    ? objet.value as Record<string, unknown>
    : objet;
}

function quantiteDepuisValeur(value: unknown): number | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return quantiteDepuisValeur((value as Record<string, unknown>).value);
  }
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
  const structure = resoudreConditionnementStructure({ conditionnement, presentation, sourceTexts });
  const canoniqueStructure = conditionnementCanonique(structure);
  if (structure.containerType && !structure.needsVerification && canoniqueStructure) {
    return canoniqueStructure;
  }
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
    const evidence = JSON.parse(evidenceJson) as unknown;
    const presentations = collecterValeursParCle(evidence, "presentation")
      .map(objetStructure)
      .filter((value): value is Record<string, unknown> => value !== null);
    const presentationValue = presentations.find((value) => quantiteStructuree(value) !== null)
      ?? presentations[0]
      ?? {};
    const quantitePresentation = presentations
      .map(quantiteStructuree)
      .find((value) => value !== null) ?? null;
    const quantiteChamp = collecterValeursParCle(evidence, "deliveredQuantity")
      .map(quantiteDepuisValeur)
      .find((value) => value !== null) ?? null;
    const presentation = {
      ...presentationValue,
      ...(quantitePresentation !== null
        ? { deliveredQuantity: quantitePresentation }
        : quantiteChamp !== null
          ? { deliveredQuantity: quantiteChamp }
          : {}),
    };
    const sourceTexts = collecterTextesSources(evidence);
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

export function formaterConditionnementVisuel(value: string | null | undefined): ConditionnementVisuel {
  const { presentation, quantite } = analyserPresentation(value);
  if (!presentation) {
    return { ligne: quantite !== null ? `Qté ${quantite}` : null, totalDoses: null };
  }
  if (quantite === null) {
    return { ligne: formaterPresentationCompacte(value), totalDoses: null };
  }

  const contenant = presentation.match(/^(flacon|a[ée]rosol|ampoule|bo[iî]te|seringue|pr[ée]sentoir)s?\b/i);
  if (!contenant) {
    return {
      ligne: `${quantite} × ${presentation.replace(/^./, (lettre) => lettre.toLowerCase())}`,
      totalDoses: null,
    };
  }
  const singulier = contenant[1].toLowerCase()
    .replace("aerosol", "aérosol")
    .replace("boite", "boîte")
    .replace("presentoir", "présentoir");
  const pluriels: Record<string, string> = {
    flacon: "flacons",
    aérosol: "aérosols",
    ampoule: "ampoules",
    boîte: "boîtes",
    seringue: "seringues",
    présentoir: "présentoirs",
  };
  const nomContenant = quantite > 1 ? pluriels[singulier] : singulier;
  const suiteBrute = presentation.slice(contenant[0].length).trim();
  const suite = singulier === "boîte" ? suiteBrute : suiteBrute.replace(/^de\s+/i, "");
  const doses = presentation.match(/\b(\d+)\s*doses?\b/i);
  const suffixeChacun = doses && quantite > 1
    ? ` ${singulier === "boîte" || singulier === "seringue" || singulier === "ampoule" ? "chacune" : "chacun"}`
    : "";
  const ligne = `${quantite} × ${nomContenant}${suite ? ` ${suite}` : ""}${suffixeChacun}`;
  const totalDoses = doses && quantite > 1
    ? `${quantite * Number(doses[1])} doses au total`
    : null;

  return { ligne, totalDoses };
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

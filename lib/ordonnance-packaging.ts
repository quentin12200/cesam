export const FORMES_CONDITIONNEMENT = [
  "flacon",
  "seringue",
  "sachet",
  "boîte",
  "ampoule",
  "aérosol",
  "tube",
  "bidon",
  "pot",
] as const;

export const UNITES_CONDITIONNEMENT = ["ml", "l", "g", "mg", "kg", "dose"] as const;

export interface ConditionnementStructure {
  deliveredQuantity: number | null;
  containerType: string | null;
  contentValue: number | null;
  contentUnit: string | null;
  dosesPerContainer: number | null;
  sourceText: string | null;
  needsVerification: boolean;
  rawContainerType: string | null;
}

const FORMES_OCR: Record<string, string> = {
  FL: "flacon",
  FLACON: "flacon",
  SER: "seringue",
  SERINGUE: "seringue",
  SACH: "sachet",
  SACHET: "sachet",
  BT: "boîte",
  BOITE: "boîte",
  AMP: "ampoule",
  AMPOULE: "ampoule",
  AER: "aérosol",
  AEROSOL: "aérosol",
  TUBE: "tube",
  BIDON: "bidon",
  POT: "pot",
};

const FORMES_DOUTEUSES = new Set(["PRESENTOIR"]);

function sansAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function nombre(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function valeur(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) {
    return (value as Record<string, unknown>).value;
  }
  return value;
}

function uniteCanonique(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized = sansAccents(value).toLowerCase().replace(/[.\s]+/g, "");
  if (/^m(?:l|i|1)$/.test(normalized)) return "ml";
  if (normalized === "d" || normalized === "dose" || normalized === "doses") return "dose";
  return normalized;
}

function structureVide(sourceText: string | null = null): ConditionnementStructure {
  return {
    deliveredQuantity: null,
    containerType: null,
    contentValue: null,
    contentUnit: null,
    dosesPerContainer: null,
    sourceText,
    needsVerification: false,
    rawContainerType: null,
  };
}

/** Lit uniquement une expression qui contient explicitement un contenant.
 * Une simple dose comme « Administrer 2 ml » ne peut donc jamais devenir un
 * conditionnement. */
export function extraireConditionnementDepuisTexte(sourceText: string): ConditionnementStructure | null {
  const source = sourceText.trim();
  if (!source) return null;
  const normalise = sansAccents(source).toUpperCase().replace(/\s+/g, " ");
  const motifContenant = /(?:^|\s)(?:(\d+)\s*[X×]?\s*)?(FL(?:ACON)?|SER(?:INGUE)?|SACH(?:ET)?|BT|BOITE|AMP(?:OULE)?|AER(?:OSOL)?|TUBE|BIDON|POT|PRESENTOIR)S?\.?\b/gi;
  const contenants = [...normalise.matchAll(motifContenant)];
  if (contenants.length === 0) return null;
  const candidats = contenants.map((match, index) => {
    const debutSuite = (match.index ?? 0) + match[0].length;
    const finSuite = contenants[index + 1]?.index ?? normalise.length;
    const suiteLocale = normalise.slice(debutSuite, finSuite);
    const contenuLocal = suiteLocale.match(/(?:\bDE\s*)?(\d+(?:[.,]\d+)?)\s*(ML|L|G|MG|KG)\b/i);
    const dosesLocales = suiteLocale.match(/(?:^|[\s(·-])(?:DE\s*)?(\d+(?:[.,]\d+)?)\s*D(?:\.|OSES?)?\s*\)?/i);
    return { match, suiteLocale, contenuLocal, dosesLocales };
  });
  const candidat = [...candidats].sort((left, right) => {
    const scoreLeft = (left.contenuLocal ? 2 : 0) + (left.dosesLocales ? 1 : 0);
    const scoreRight = (right.contenuLocal ? 2 : 0) + (right.dosesLocales ? 1 : 0);
    return scoreRight - scoreLeft;
  })[0];
  const contenant = candidat.match;

  const code = contenant[2].toUpperCase();
  const connu = FORMES_OCR[code] ?? null;
  const douteux = FORMES_DOUTEUSES.has(code);
  if (!connu && !douteux) return null;
  const contenu = candidat.contenuLocal;
  const doses = candidat.dosesLocales
    ?? normalise.match(/(?:^|[\s(·-])(?:DE\s*)?(\d+(?:[.,]\d+)?)\s*D(?:\.|OSES?)?\s*\)?/i);

  return {
    deliveredQuantity: nombre(contenant[1]),
    containerType: connu ?? "autre",
    contentValue: nombre(contenu?.[1]),
    contentUnit: uniteCanonique(contenu?.[2]),
    dosesPerContainer: nombre(doses?.[1]),
    sourceText: source,
    needsVerification: douteux,
    rawContainerType: douteux ? code : null,
  };
}

export function conditionnementDepuisPresentation(
  presentation: Record<string, unknown> | null | undefined,
  sourceText: string | null = null,
): ConditionnementStructure | null {
  if (!presentation) return null;
  const containerRaw = valeur(presentation.containerType);
  const containerText = typeof containerRaw === "string" ? sansAccents(containerRaw).toUpperCase().trim() : "";
  const containerType = FORMES_OCR[containerText]
    ?? (FORMES_CONDITIONNEMENT.includes(containerText.toLowerCase() as typeof FORMES_CONDITIONNEMENT[number])
      ? containerText.toLowerCase()
      : null);
  if (!containerType) return null;
  return {
    deliveredQuantity: nombre(valeur(presentation.deliveredQuantity)),
    containerType,
    contentValue: nombre(valeur(presentation.volumeValue ?? presentation.contentValue)),
    contentUnit: uniteCanonique(String(valeur(presentation.volumeUnit ?? presentation.contentUnit) ?? "")),
    dosesPerContainer: nombre(valeur(presentation.dosesPerContainer)),
    sourceText,
    needsVerification: false,
    rawContainerType: null,
  };
}

function quantiteExplicite(textes: string[]): number | null {
  for (const texte of textes) {
    const match = texte.match(/\b(?:QT[EÉ]|QUANTIT[EÉ])\s*[:=]?\s*(\d+)\b/i);
    if (match) return nombre(match[1]);
  }
  return null;
}

function score(structure: ConditionnementStructure): number {
  return (structure.needsVerification ? 0 : 4)
    + (structure.contentValue !== null && structure.contentUnit ? 3 : 0)
    + (structure.dosesPerContainer !== null ? 2 : 0)
    + (structure.deliveredQuantity !== null ? 1 : 0);
}

export function resoudreConditionnementStructure({
  conditionnement,
  presentation,
  sourceTexts = [],
}: {
  conditionnement?: string | null;
  presentation?: Record<string, unknown> | null;
  sourceTexts?: string[];
}): ConditionnementStructure {
  const textes = [conditionnement, ...sourceTexts]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  const candidats = textes
    .map(extraireConditionnementDepuisTexte)
    .filter((item): item is ConditionnementStructure => item !== null);
  const structuree = conditionnementDepuisPresentation(
    presentation,
    typeof presentation?.sourceText === "string" ? presentation.sourceText : null,
  );
  if (structuree) candidats.push(structuree);
  const meilleure = candidats.sort((left, right) => score(right) - score(left))[0]
    ?? structureVide(conditionnement?.trim() || null);
  const deliveredQuantity = nombre(valeur(presentation?.deliveredQuantity))
    ?? quantiteExplicite(textes)
    ?? meilleure.deliveredQuantity;
  return { ...meilleure, deliveredQuantity };
}

function nombreLisible(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

export function conditionnementCanonique(structure: ConditionnementStructure): string | null {
  if (!structure.containerType) return structure.sourceText?.trim() || null;
  if (structure.needsVerification && structure.sourceText) return structure.sourceText.trim();
  const doses = structure.dosesPerContainer !== null
    ? `${nombreLisible(structure.dosesPerContainer)} dose${structure.dosesPerContainer > 1 ? "s" : ""}`
    : null;
  if (structure.containerType === "boîte" && structure.contentValue === null && doses) {
    return `${structure.deliveredQuantity !== null ? `${nombreLisible(structure.deliveredQuantity)} ` : ""}boîte de ${doses}`;
  }
  const parties = [
    structure.deliveredQuantity !== null ? nombreLisible(structure.deliveredQuantity) : null,
    structure.containerType.toLowerCase(),
    structure.contentValue !== null && structure.contentUnit
      ? `de ${nombreLisible(structure.contentValue)} ${structure.contentUnit}`
      : null,
  ].filter(Boolean);
  return `${parties.join(" ")}${doses ? ` · ${doses}` : ""}`.trim() || null;
}

/** Conserve les autres preuves OCR mais remplace la présentation par la
 * correction structurée explicitement validée par l'utilisateur. */
export function evidenceAvecConditionnementCorrige(
  evidenceJson: string | null | undefined,
  conditionnement: string | null | undefined,
): string | null {
  const structure = resoudreConditionnementStructure({ conditionnement });
  if (!structure.containerType || structure.needsVerification) return evidenceJson ?? null;
  let evidence: Record<string, unknown> = {};
  if (evidenceJson) {
    try {
      const parsed = JSON.parse(evidenceJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) evidence = parsed;
    } catch {}
  }
  const value = {
    containerType: structure.containerType,
    volumeValue: structure.contentValue,
    volumeUnit: structure.contentUnit,
    dosesPerContainer: structure.dosesPerContainer,
    deliveredQuantity: structure.deliveredQuantity,
  };
  const preuve = { value, sourceText: null, confidence: 1, zone: "correction_manuelle" };
  return JSON.stringify({
    ...evidence,
    presentation: preuve,
    ...(structure.deliveredQuantity !== null ? {
      deliveredQuantity: {
        value: structure.deliveredQuantity,
        sourceText: null,
        confidence: 1,
        zone: "correction_manuelle",
      },
    } : { deliveredQuantity: undefined }),
  });
}

function plurielForme(forme: string, quantite: number): string {
  if (quantite <= 1) return forme;
  if (forme === "bocal") return "bocaux";
  return forme.endsWith("s") ? forme : `${forme}s`;
}

export function apercuConditionnement(structure: ConditionnementStructure): {
  ligne: string | null;
  totalDoses: string | null;
} {
  if (!structure.containerType) return { ligne: structure.sourceText, totalDoses: null };
  const forme = structure.containerType === "autre"
    ? (structure.rawContainerType?.toLowerCase() || "autre contenant")
    : structure.containerType;
  const quantite = structure.deliveredQuantity;
  const prefixe = quantite !== null ? `${nombreLisible(quantite)} × ` : "";
  const contenu = structure.contentValue !== null && structure.contentUnit
    ? ` ${nombreLisible(structure.contentValue)} ${structure.contentUnit === "ml" ? "mL" : structure.contentUnit}`
    : "";
  const boiteDoses = structure.containerType === "boîte" && !contenu && structure.dosesPerContainer !== null;
  const doses = structure.dosesPerContainer !== null
    ? `${boiteDoses ? " de" : " ·"} ${nombreLisible(structure.dosesPerContainer)} dose${structure.dosesPerContainer > 1 ? "s" : ""}${!boiteDoses && quantite !== null && quantite > 1 ? " chacun" : ""}`
    : "";
  const total = quantite !== null && structure.dosesPerContainer !== null
    ? quantite * structure.dosesPerContainer
    : null;
  return {
    ligne: `${prefixe}${plurielForme(forme, quantite ?? 1)}${contenu}${doses}`,
    totalDoses: total !== null
      ? `${nombreLisible(total)} dose${total > 1 ? "s" : ""} au total`
      : null,
  };
}

import type { DosePratiqueContextuelle } from "./ordonnance-types.ts";

export interface DoseSourceStructuree {
  doseValue: string;
  doseUnit: string;
  referenceValue: string;
  referenceUnit: string;
  referenceType: string;
  sourceText: string | null;
}

export interface DosePharmacologiqueCalcul {
  substance: string;
  mgParKg: number;
  mgParKgMax?: number;
}

export interface ConcentrationCalcul {
  substance: string;
  mgParMl: number;
  fiable: boolean;
}

export interface ResolutionSourcesDose {
  dosePratique: DoseSourceStructuree | null;
  dosePharmacologique: DoseSourceStructuree | null;
  doseAffichee: DoseSourceStructuree | null;
  sourceHybrideDetectee: boolean;
}

interface DoseStructureeEntree {
  doseValue: string;
  doseUnit: string;
  referenceValue: string;
  referenceUnit: string;
  referenceType: string;
  doseSourceText?: string | null;
  doseSourceTexts?: Array<string | null | undefined>;
  dosePratique?: DoseSourceStructuree | null;
  dosePharmacologique?: DoseSourceStructuree | null;
  correctionManuelle?: boolean;
}

function sansAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function estInstructionReconstitution(value: string | null | undefined): boolean {
  const source = sansAccents(value?.trim() ?? "").toLowerCase();
  if (!source) return false;
  return /\b(?:reconstituer|reconstitution|solvant|diluer|dilution)\b/.test(source)
    || /^\s*\d+(?:[.,]\d+)?\s*doses?\s*(?:(?:[-=]+>|→|:|=)\s*)?\d+(?:[.,]\d+)?\s*ml\b/.test(source);
}

function nombre(value: string): string {
  return value.replace(",", ".");
}

function uniteNormalisee(value: string): string {
  return sansAccents(value).toLowerCase().replace(/[^a-zµμ]/g, "");
}

function categorieDepuisTexte(value: string): string | null {
  const source = sansAccents(value).toLowerCase();
  if (/\b(?:veaux|veau)\b/.test(source)) return "Veaux";
  if (/\b(?:bovins?\s+adultes?|adultes?)\b/.test(source)) return "Adultes";
  return null;
}

function categorieLocale(avantDose: string, apresDose: string): string | null {
  const suffixe = sansAccents(apresDose).toLowerCase().match(
    /\b(?:pour|chez)\s+(?:les?\s+)?(bovins?\s+adultes?|adultes?|veaux|veau)\b/,
  );
  if (suffixe) return categorieDepuisTexte(suffixe[1]);

  const categoriesAvant = Array.from(sansAccents(avantDose).toLowerCase().matchAll(
    /\b(bovins?\s+adultes?|adultes?|veaux|veau)\b/g,
  ));
  return categoriesAvant.length > 0
    ? categorieDepuisTexte(categoriesAvant.at(-1)?.[1] ?? "")
    : null;
}

function cleDosePratique(dose: DosePratiqueContextuelle): string {
  return [
    nombre(dose.doseValue),
    uniteNormalisee(dose.doseUnit),
    dose.poidsMinKg ? nombre(dose.poidsMinKg) : "",
    dose.poidsMaxKg ? nombre(dose.poidsMaxKg) : "",
    dose.frequence?.toLowerCase() ?? "",
  ].join("|");
}

export function dosesPratiquesIncoherentes(doses: DosePratiqueContextuelle[]): boolean {
  const groupes = new Map<string, DosePratiqueContextuelle[]>();
  for (const dose of doses) {
    const categorie = sansAccents(dose.categorieAnimaux ?? "sans categorie").toLowerCase();
    groupes.set(categorie, [...(groupes.get(categorie) ?? []), dose]);
  }

  return Array.from(groupes.values()).some((groupe) => {
    const dosesPrincipales = new Set(groupe.filter((dose) => !dose.maximum).map(cleDosePratique));
    const plafonds = new Set(groupe.filter((dose) => dose.maximum).map(cleDosePratique));
    const plafondAvecPoidsEtAutreDose = groupe.some((dose) => dose.maximum && Boolean(dose.poidsMinKg))
      && groupe.some((dose) => !dose.maximum);
    return dosesPrincipales.size > 1 || plafonds.size > 1 || plafondAvecPoidsEtAutreDose;
  });
}

export function marquerDosesPratiquesIncoherentes(
  doses: DosePratiqueContextuelle[],
): DosePratiqueContextuelle[] {
  if (!dosesPratiquesIncoherentes(doses)) return doses;
  return doses.map((dose) => ({ ...dose, aVerifier: true }));
}

export function extraireDosesPratiquesContextuelles(sourceTexts: string[]): DosePratiqueContextuelle[] {
  const resultats: DosePratiqueContextuelle[] = [];
  for (const sourceText of sourceTexts) {
    const texte = sourceText.trim();
    if (estInstructionReconstitution(texte)) continue;
    const frequenceCommune = /\b(?:par|chaque)\s+jour\b|\/\s*jour\b|\bquotidien(?:ne)?\b/i.test(texte)
      && !/\b(?:par|chaque)\s+(?:semaine|mois)\b|\btoutes?\s+les?\s+\d+\s*(?:h|heures?)\b/i.test(texte)
      ? "par jour" : null;
    const matches = Array.from(texte.matchAll(
      /\b(\d+(?:[.,]\d+)?)\s*(ml|cl|l|g|comprim(?:e|é)s?|cp|bolus)\b/giu,
    ));
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const debutDose = match.index ?? 0;
      const finDose = debutDose + match[0].length;
      const debutLocal = matches[index - 1]
        ? (matches[index - 1].index ?? 0) + matches[index - 1][0].length
        : 0;
      const finLocal = matches[index + 1]?.index ?? texte.length;
      const avant = texte.slice(debutLocal, debutDose);
      const apres = texte.slice(finDose, finLocal);
      const poids = apres.match(/(?:pour|par|\/)\s*(\d+(?:[.,]\d+)?)\s*(?:a|à|-|–)?\s*(\d+(?:[.,]\d+)?)?\s*kg\b/iu);
      const frequence = /\b(?:par|chaque)\s+jour\b|\/\s*jour\b|\bquotidien(?:ne)?\b/i.test(apres)
        ? "par jour" : frequenceCommune;
      const unite = sansAccents(match[2]).toLowerCase().startsWith("comprim") || /^cp$/i.test(match[2])
        ? "comprimé" : match[2].toLowerCase();
      resultats.push({
        categorieAnimaux: categorieLocale(avant, apres),
        doseValue: match[1].replace(",", "."),
        doseUnit: unite,
        poidsMinKg: poids?.[1]?.replace(",", ".") ?? null,
        poidsMaxKg: (poids?.[2] ?? poids?.[1])?.replace(",", ".") ?? null,
        frequence,
        maximum: /\b(?:max|maxi|maximum|au plus)\b/i.test(apres)
          || /\b(?:max|maxi|maximum|au plus)\s*$/i.test(avant),
        origine: "ordonnance",
        sourceText: texte,
        aVerifier: false,
      });
    }
  }
  return marquerDosesPratiquesIncoherentes(resultats);
}

function cleSubstance(value: string): string {
  return sansAccents(value).toLowerCase()
    .replace(/\b(?:dose|concentration|substance|active)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function decimal(value: string): number {
  return Number(value.replace(",", "."));
}

function segmentsSources(sourceTexts: string[]): string[] {
  return sourceTexts.flatMap((sourceText) => sourceText.split(/[\n;+]/g))
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function extraireDosesPharmacologiquesCalcul(sourceTexts: string[]): DosePharmacologiqueCalcul[] {
  const resultats: DosePharmacologiqueCalcul[] = [];
  for (const segment of segmentsSources(sourceTexts)) {
    const normalise = sansAccents(segment);
    const substanceAvant = normalise.match(
      /^\s*(?:dose\s+pharmacologique\s*[:=-]?\s*)?([a-z][a-z' -]{2,50}?)\s*[:=-]?\s*(\d+(?:[.,]\d+)?)\s*(?:a|-|–)?\s*(\d+(?:[.,]\d+)?)?\s*mg\s*(?:\/|par)\s*kg\b/i,
    );
    const doseAvant = normalise.match(
      /\b(\d+(?:[.,]\d+)?)\s*(?:a|-|–)?\s*(\d+(?:[.,]\d+)?)?\s*mg\s+(?:de|d')\s*([a-z][a-z' -]{2,50}?)\s+(?:par|\/)\s*kg\b/i,
    );
    if (substanceAvant) {
      resultats.push({
        substance: substanceAvant[1].trim(),
        mgParKg: decimal(substanceAvant[2]),
        mgParKgMax: substanceAvant[3] ? decimal(substanceAvant[3]) : undefined,
      });
    } else if (doseAvant) {
      resultats.push({
        substance: doseAvant[3].trim(),
        mgParKg: decimal(doseAvant[1]),
        mgParKgMax: doseAvant[2] ? decimal(doseAvant[2]) : undefined,
      });
    }
  }
  return resultats.filter((dose) => Number.isFinite(dose.mgParKg)
    && (dose.mgParKgMax === undefined || Number.isFinite(dose.mgParKgMax)));
}

export function extraireConcentrationsCalcul(
  sourceTexts: string[],
  fiable: boolean,
): ConcentrationCalcul[] {
  const resultats: ConcentrationCalcul[] = [];
  for (const segment of segmentsSources(sourceTexts)) {
    const normalise = sansAccents(segment);
    const substanceAvant = normalise.match(
      /^\s*(?:concentration\s*[:=-]?\s*)?([a-z][a-z' -]{2,50}?)\s*[:=-]?\s*(\d+(?:[.,]\d+)?)\s*mg\s*\/\s*ml\b/i,
    );
    const concentrationAvant = normalise.match(
      /\b(\d+(?:[.,]\d+)?)\s*mg\s*\/\s*ml\s+(?:de|d')\s*([a-z][a-z' -]{2,50})\b/i,
    );
    if (substanceAvant) {
      resultats.push({ substance: substanceAvant[1].trim(), mgParMl: decimal(substanceAvant[2]), fiable });
    } else if (concentrationAvant) {
      resultats.push({ substance: concentrationAvant[2].trim(), mgParMl: decimal(concentrationAvant[1]), fiable });
    }
  }
  return resultats.filter((concentration) => Number.isFinite(concentration.mgParMl));
}

export function choisirBaseAffichageDose(mlParKg: number): { doseMl: number; poidsKg: 1 | 10 | 100 } {
  if (mlParKg * 10 >= 1) return { doseMl: mlParKg * 10, poidsKg: 10 };
  return { doseMl: mlParKg * 100, poidsKg: 100 };
}

export function calculerDoseVolumiqueSure(
  doses: DosePharmacologiqueCalcul[],
  concentrations: ConcentrationCalcul[],
): { dose: DosePratiqueContextuelle | null; aVerifier: boolean } {
  if (doses.length === 0) return { dose: null, aVerifier: false };
  const valeurs: Array<{ min: number; max: number }> = [];
  for (const dose of doses) {
    const cle = cleSubstance(dose.substance);
    const correspondances = concentrations.filter((item) => item.fiable && cleSubstance(item.substance) === cle);
    if (correspondances.length !== 1 || correspondances[0].mgParMl <= 0) return { dose: null, aVerifier: true };
    valeurs.push({
      min: dose.mgParKg / correspondances[0].mgParMl,
      max: (dose.mgParKgMax ?? dose.mgParKg) / correspondances[0].mgParMl,
    });
  }
  const premiere = valeurs[0];
  if (!Number.isFinite(premiere.min) || !Number.isFinite(premiere.max)
    || valeurs.some((value) => Math.abs(value.min - premiere.min) > 1e-9
      || Math.abs(value.max - premiere.max) > 1e-9)) {
    return { dose: null, aVerifier: true };
  }
  const affichage = choisirBaseAffichageDose(premiere.max);
  const facteur = affichage.poidsKg;
  const minAffiche = Number((premiere.min * facteur).toFixed(6));
  const maxAffiche = Number((premiere.max * facteur).toFixed(6));
  return {
    dose: {
      categorieAnimaux: null,
      doseValue: minAffiche === maxAffiche ? String(minAffiche) : `${minAffiche} à ${maxAffiche}`,
      doseUnit: "ml",
      poidsMinKg: String(affichage.poidsKg),
      poidsMaxKg: String(affichage.poidsKg),
      frequence: null,
      maximum: false,
      origine: "calculee",
      sourceText: null,
      aVerifier: false,
    },
    aVerifier: false,
  };
}

export function formaterDosePratiqueContextuelle(dose: DosePratiqueContextuelle): string {
  if (dose.maximum && !dose.poidsMinKg) {
    const frequencePlafond = dose.frequence ? ` / ${dose.frequence.replace(/^par\s+/i, "")}` : "";
    return `Max : ${dose.doseValue} ${dose.doseUnit}${frequencePlafond}`;
  }
  const categorie = dose.categorieAnimaux ? `${dose.categorieAnimaux} : ` : "";
  const maximum = dose.maximum ? " max" : "";
  const poids = dose.poidsMinKg
    ? ` / ${dose.poidsMinKg}${dose.poidsMaxKg && dose.poidsMaxKg !== dose.poidsMinKg ? `–${dose.poidsMaxKg}` : ""} kg`
    : "";
  const frequence = dose.frequence ? ` / ${dose.frequence.replace(/^par\s+/i, "")}` : "";
  return `${categorie}${dose.doseValue} ${dose.doseUnit}${maximum}${poids}${frequence}`;
}

export function estUniteDosePratique(value: string): boolean {
  return /^(?:ml|cl|l|g|grammes?|comprimes?|cp|bolus|unites?)$/.test(uniteNormalisee(value));
}

export function estUniteDosePharmacologique(value: string): boolean {
  return /^(?:mg|mcg|µg|μg|ug)$/.test(uniteNormalisee(value));
}

function referenceType(referenceUnit: string): string {
  return uniteNormalisee(referenceUnit) === "kg" ? "live_weight" : "animal";
}

function doseDepuisMatch(match: RegExpMatchArray, unite: string, sourceText: string): DoseSourceStructuree {
  const reference = match[3] ?? "";
  const referenceUnit = match[4] ?? "";
  return {
    doseValue: nombre(match[1] ?? ""),
    doseUnit: unite,
    referenceValue: referenceUnit && uniteNormalisee(referenceUnit) === "kg" ? nombre(reference || "1") : "",
    referenceUnit: referenceUnit && uniteNormalisee(referenceUnit) === "kg" ? "kg" : "",
    referenceType: referenceType(referenceUnit),
    sourceText: sourceText.trim(),
  };
}

export function extraireSourcesDose(sourceText: string | null | undefined): {
  dosePratique: DoseSourceStructuree | null;
  dosePharmacologique: DoseSourceStructuree | null;
} {
  const texte = sourceText?.trim() ?? "";
  if (!texte) return { dosePratique: null, dosePharmacologique: null };
  if (estInstructionReconstitution(texte)) {
    return { dosePratique: null, dosePharmacologique: null };
  }

  const tokens = Array.from(texte.matchAll(
    /\b(\d+(?:[.,]\d+)?)\s*(ml|cl|l|g|grammes?|comprim(?:e|é)s?|cp|bolus|unit(?:e|é)s?|mg|mcg|µg|μg|ug)\b/giu,
  ));
  let dosePratique: DoseSourceStructuree | null = null;
  let dosePharmacologique: DoseSourceStructuree | null = null;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const debut = token.index ?? 0;
    const finToken = debut + token[0].length;
    // Une référence située après une autre valeur de dose appartient à cette
    // dernière expression et ne peut jamais être rattachée à la précédente.
    const finLocale = tokens[index + 1]?.index ?? texte.length;
    const suiteLocale = texte.slice(finToken, finLocale);
    const reference = suiteLocale.match(
      /(?:^|\s)(?:pour|par|\/)\s*(?:(\d+(?:[.,]\d+)?)\s*)?(kg|animal(?:aux)?|bovin(?:s)?)\b(?:\s+de\s+poids\s+vif)?/iu,
    );
    if (!reference) continue;

    const uniteBrute = token[2] ?? "";
    const unite = /^(?:comprime|cp)/i.test(sansAccents(uniteBrute))
      ? "comprimé"
      : uniteNormalisee(uniteBrute).replace("μ", "µ");
    const prefixe = texte.slice(0, debut).match(/soit\s*$/iu)?.[0] ?? "";
    const sourceLocale = texte.slice(
      debut - prefixe.length,
      finToken + (reference.index ?? 0) + reference[0].length,
    ).trim();
    const matchLocal = [
      token[0],
      token[1],
      uniteBrute,
      reference[1],
      reference[2],
    ] as unknown as RegExpMatchArray;
    const dose = doseDepuisMatch(matchLocal, unite, sourceLocale);

    if (!dosePratique && estUniteDosePratique(unite)) dosePratique = dose;
    if (!dosePharmacologique && estUniteDosePharmacologique(unite)) dosePharmacologique = dose;
  }

  return { dosePratique, dosePharmacologique };
}

function doseEntree(input: DoseStructureeEntree): DoseSourceStructuree | null {
  if (!input.doseValue || !input.doseUnit) return null;
  return {
    doseValue: input.doseValue,
    doseUnit: input.doseUnit,
    referenceValue: input.referenceValue,
    referenceUnit: input.referenceUnit,
    referenceType: input.referenceType,
    sourceText: null,
  };
}

function memeDose(a: DoseSourceStructuree, b: DoseSourceStructuree): boolean {
  return a.doseValue === b.doseValue
    && uniteNormalisee(a.doseUnit) === uniteNormalisee(b.doseUnit)
    && a.referenceValue === b.referenceValue
    && uniteNormalisee(a.referenceUnit) === uniteNormalisee(b.referenceUnit);
}

/**
 * Résout les doses sans jamais recomposer une posologie à partir de fragments.
 * Une correction humaine est la seule situation où les champs structurés sont
 * acceptés sans preuve OCR, car l'utilisateur en devient explicitement la source.
 */
export function resoudreSourcesDose(input: DoseStructureeEntree): ResolutionSourcesDose {
  const structuree = doseEntree(input);
  if (input.correctionManuelle) {
    return {
      dosePratique: structuree && estUniteDosePratique(structuree.doseUnit) ? structuree : input.dosePratique ?? null,
      dosePharmacologique: structuree && estUniteDosePharmacologique(structuree.doseUnit)
        ? structuree : input.dosePharmacologique ?? null,
      doseAffichee: structuree,
      sourceHybrideDetectee: false,
    };
  }

  const textesSources = [
    input.dosePratique?.sourceText,
    input.dosePharmacologique?.sourceText,
    input.doseSourceText,
    ...(input.doseSourceTexts ?? []),
  ].filter((value, index, values): value is string => (
    Boolean(value?.trim()) && values.indexOf(value) === index
  ));
  const dosesSourcees = textesSources.map(extraireSourcesDose);
  const dosePratiqueSourcee = dosesSourcees.find((dose) => dose.dosePratique)?.dosePratique ?? null;
  const dosePharmacologiqueSourcee = dosesSourcees.find((dose) => dose.dosePharmacologique)?.dosePharmacologique ?? null;
  const structureeCorrespondAUneSource = Boolean(
    structuree
    && [dosePratiqueSourcee, dosePharmacologiqueSourcee].some((dose) => dose && memeDose(structuree, dose)),
  );
  const dosePratique = dosePratiqueSourcee
    ?? (textesSources.length === 0 && structuree && estUniteDosePratique(structuree.doseUnit) ? structuree : null);
  const dosePharmacologique = dosePharmacologiqueSourcee
    ?? (textesSources.length === 0 && structuree && estUniteDosePharmacologique(structuree.doseUnit) ? structuree : null);

  const sourceHybrideDetectee = Boolean(
    structuree
    && textesSources.length > 0
    && !structureeCorrespondAUneSource
    && (
      (dosePharmacologique
        && structuree.doseValue === dosePharmacologique.doseValue
        && uniteNormalisee(structuree.doseUnit) === uniteNormalisee(dosePharmacologique.doseUnit))
      || (dosePratique
        && structuree.referenceValue === dosePratique.referenceValue
        && uniteNormalisee(structuree.referenceUnit) === uniteNormalisee(dosePratique.referenceUnit))
    )
  );

  const doseAffichee = dosePratique ?? dosePharmacologique
    ?? (textesSources.length > 0 ? null : structuree);
  return { dosePratique, dosePharmacologique, doseAffichee, sourceHybrideDetectee };
}

export function formaterDoseSource(dose: DoseSourceStructuree | null): string | null {
  if (!dose?.doseValue || !dose.doseUnit) return null;
  const base = `${dose.doseValue} ${dose.doseUnit}`;
  if (dose.referenceType === "animal") return `${base} / animal`;
  if (!dose.referenceValue || !dose.referenceUnit) return base;
  return `${base} / ${dose.referenceValue} ${dose.referenceUnit}`;
}

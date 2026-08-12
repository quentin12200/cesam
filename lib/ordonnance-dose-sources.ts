export interface DoseSourceStructuree {
  doseValue: string;
  doseUnit: string;
  referenceValue: string;
  referenceUnit: string;
  referenceType: string;
  sourceText: string | null;
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

function nombre(value: string): string {
  return value.replace(",", ".");
}

function uniteNormalisee(value: string): string {
  return sansAccents(value).toLowerCase().replace(/[^a-zµμ]/g, "");
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

  const pratique = texte.match(
    /\b(\d+(?:[.,]\d+)?)\s*(ml|cl|l|g|grammes?|comprim(?:e|é)s?|cp|bolus|unit(?:e|é)s?)(?:\s+de\s+[^,;]{1,60}?)?\s*(?:pour|par|\/)\s*(?:(\d+(?:[.,]\d+)?)\s*)?(kg|animal(?:aux)?|bovin(?:s)?)\b/i,
  );
  const pharmacologique = texte.match(
    /\b(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|μg|ug)(?:\s+d[’'][^,;]{1,80}?)?\s*(?:pour|par|\/)\s*(?:(\d+(?:[.,]\d+)?)\s*)?(kg)\b/i,
  );

  const unitePratique = pratique?.[2]
    ? (/^(?:comprime|cp)/i.test(sansAccents(pratique[2])) ? "comprimé" : uniteNormalisee(pratique[2]))
    : "";
  const unitePharmacologique = pharmacologique?.[2]
    ? uniteNormalisee(pharmacologique[2]).replace("μ", "µ")
    : "";
  return {
    dosePratique: pratique ? doseDepuisMatch(pratique, unitePratique, texte) : null,
    dosePharmacologique: pharmacologique ? doseDepuisMatch(pharmacologique, unitePharmacologique, texte) : null,
  };
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

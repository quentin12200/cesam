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
}): string | null {
  const doseStructuree = formaterDoseStructureeCompacte(med);
  if (med.preferStructuredDose) return doseStructuree;
  const dosePratique = resoudreDosePratique(med);
  if (dosePratique) return formaterDoseStructureeCompacte(dosePratique);
  return doseStructuree;
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
  if (med.doseValue && med.doseUnit && estUniteDosePratique(med.doseUnit)) {
    return {
      doseValue: med.doseValue,
      doseUnit: med.doseUnit,
      referenceValue: med.referenceValue,
      referenceUnit: med.referenceUnit,
      referenceType: med.referenceType,
    };
  }
  return extraireDosePratique(
    med.doseSourceText,
    [med.formePharmaceutique, med.conditionnement].filter(Boolean).join(" "),
  );
}

function formaterDoseStructureeCompacte(med: {
  doseValue: string;
  doseUnit: string;
  referenceValue: string;
  referenceUnit: string;
  referenceType: string;
}): string | null {
  if (!med.doseValue || !med.doseUnit) return null;
  const base = `${med.doseValue} ${med.doseUnit}`;
  if (med.referenceType === "animal") return `${base} / animal`;
  if (!med.referenceValue || !med.referenceUnit) return base;
  return `${base} / ${med.referenceValue} ${med.referenceUnit}`;
}

function estUniteDosePratique(value: string): boolean {
  const unite = sansAccents(value).toLowerCase().replace(/[^a-z]/g, "");
  return /^(?:ml|cl|l|g|grammes?|comprimes?|cp|bolus|unites?)$/.test(unite);
}

function extraireDosePratique(
  doseSourceText: string | null | undefined,
  presentation: string,
): DoseStructuree | null {
  const texte = doseSourceText?.trim() ?? "";
  if (!texte) return null;
  const contexte = sansAccents(`${presentation} ${texte}`).toLowerCase();
  const estLiquide = /\b(solution|injectable|injection|flacon|liquide|aerosol)\b/.test(contexte);
  const estPoudre = /\bpoudre\b/.test(contexte);
  const estUnite = /\b(comprime|cp|bolus)\b/.test(contexte);
  const unites = estLiquide ? "ml" : estPoudre ? "g" : estUnite ? "comprim(?:e|é)s?|cp|bolus" : "ml|g|comprim(?:e|é)s?|cp|bolus";
  const pattern = new RegExp(
    `\\b(\\d+(?:[.,]\\d+)?)\\s*(${unites})\\s*(?:pour|par|/)\\s*(?:(\\d+(?:[.,]\\d+)?)\\s*)?(kg|animal(?:aux)?|bovin(?:s)?)\\b`,
    "i",
  );
  const match = texte.match(pattern);
  if (!match) return null;
  const valeur = match[1].replace(",", ".");
  const uniteBrute = sansAccents(match[2]).toLowerCase();
  const unite = /^(?:comprime|cp)/.test(uniteBrute) ? "comprimé" : uniteBrute;
  const referenceKg = sansAccents(match[4]).toLowerCase() === "kg";
  return {
    doseValue: valeur,
    doseUnit: unite,
    referenceValue: referenceKg ? match[3]?.replace(",", ".") ?? "1" : "",
    referenceUnit: referenceKg ? "kg" : "",
    referenceType: referenceKg ? "live_weight" : "animal",
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

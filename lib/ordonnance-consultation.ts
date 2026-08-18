function estDosePratique(value: string): boolean {
  return /\b(?:ml|cl|l|g|comprim(?:é|e)s?|cp|bolus)\b/i.test(value)
    && !/^\s*\d+(?:[.,]\d+)?\s*(?:mg|mcg)\b/i.test(value);
}

export function lignesDosePratiqueConsultation(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value.split(/\r?\n/g)
    .map((line) => line.trim().replace(/\s+de poids vif\b/gi, ""))
    .filter((line) => line.length > 0 && estDosePratique(line))
    .map((line) => /^(?:adultes?|veaux?|max|à administrer)\s*:/i.test(line)
      ? line
      : `À administrer : ${line}`);
}

export function formaterVoiesConsultation(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().replace(/\s*(?:\/|,|;)\s*/g, " · ");
}

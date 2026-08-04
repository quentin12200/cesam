import type { ChampExtrait } from "./ordonnance-types.ts";

export function extraireDateFrancaise(sourceText: string | null | undefined): string | null {
  if (!sourceText) return null;
  const matches = sourceText.matchAll(/\b([0-3]?\d)[/.\-]([01]?\d)[/.\-](\d{4})\b/g);
  for (const match of matches) {
    const jour = Number(match[1]);
    const mois = Number(match[2]);
    const annee = Number(match[3]);
    if (annee < 1900 || annee > 2200) continue;
    const date = new Date(Date.UTC(annee, mois - 1, jour));
    if (
      date.getUTCFullYear() !== annee
      || date.getUTCMonth() !== mois - 1
      || date.getUTCDate() !== jour
    ) continue;
    return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
  }
  return null;
}

function dateValide(jourBrut: string, moisBrut: string, anneeBrute: string): string | null {
  const jour = Number(jourBrut);
  const mois = Number(moisBrut);
  const annee = Number(anneeBrute);
  if (annee < 1900 || annee > 2200) return null;
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  if (
    date.getUTCFullYear() !== annee
    || date.getUTCMonth() !== mois - 1
    || date.getUTCDate() !== jour
  ) return null;
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

export function extraireDateOrdonnance(sourceText: string | null | undefined): string | null {
  if (!sourceText) return null;
  const match = sourceText.match(
    /ordonnance\s+n(?:[°o.]?\s*)?[a-z0-9][\s\S]{0,60}?\ble\s+([0-3]?\d)[/.\-]([01]?\d)[/.\-](\d{4})/i,
  );
  return match ? dateValide(match[1], match[2], match[3]) : null;
}

export function extraireDateDerniereVisite(sourceText: string | null | undefined): string | null {
  if (!sourceText) return null;
  const match = sourceText.match(
    /derni[eè]re\s+visite(?:\s+le)?\s*:?\s*([0-3]?\d)[/.\-]([01]?\d)[/.\-](\d{4})/i,
  );
  return match ? dateValide(match[1], match[2], match[3]) : null;
}

export function extraireDateDelivrance(sourceText: string | null | undefined): string | null {
  if (!sourceText) return null;
  const match = sourceText.match(
    /(?:d[ée]livr[ée]e?\s+le|date\s+de\s+d[ée]livrance|d[ée]livrance)\s*:?\s*([0-3]?\d)[/.\-]([01]?\d)[/.\-](\d{4})/i,
  );
  return match ? dateValide(match[1], match[2], match[3]) : null;
}

export function sourceJustifieDateDelivrance(sourceText: string | null | undefined): boolean {
  if (!sourceText) return false;
  const source = sourceText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return /\b(delivre(?:e)? le|delivre(?:e)? ce jour|date de delivrance|delivrance)\b/.test(source);
}

export function sourceIndiqueDelivreCeJour(sourceText: string | null | undefined): boolean {
  if (!sourceText) return false;
  const source = sourceText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return /\bdelivre(?:e)? ce jour\b/.test(source);
}

export function securiserDateDelivrance(
  value: string | null | undefined,
  evidence: ChampExtrait<unknown> | null | undefined,
): string | null {
  if (!value) return null;
  if (sourceJustifieDateDelivrance(evidence?.sourceText)) return value;
  return null;
}

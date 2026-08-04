import type { ChampExtrait } from "./ordonnance-types.ts";

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

export function securiserDateDelivrance(
  value: string | null | undefined,
  evidence: ChampExtrait<unknown> | null | undefined,
): string | null {
  if (!value) return null;
  if (sourceJustifieDateDelivrance(evidence?.sourceText)) return value;
  return null;
}

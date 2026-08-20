function sansAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export interface MedicationSelectionCandidate {
  nomExtrait: string;
  conditionnement?: string | null;
  evidenceJson?: string | null;
  medicamentId?: string | null;
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

function valeurPositive(value: unknown): boolean {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return valeurPositive((value as Record<string, unknown>).value);
  }
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0;
}

function lireEvidence(evidenceJson: string | null | undefined): unknown | null {
  if (!evidenceJson) return null;
  try {
    return JSON.parse(evidenceJson) as unknown;
  } catch {
    return null;
  }
}

function textesEvidence(evidence: unknown): string[] {
  return collecterValeursParCle(evidence, "sourceText")
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

const PRESENTATION_VETERINAIRE = /\b(?:\d+\s*[x×]?\s*)?(?:fl(?:acon)?|ser(?:ingue)?|amp(?:oule)?|aer(?:osol)?|presentoir|bt|boite)s?\.?\s*(?:de\s*)?\d+(?:[.,]\d+)?\s*(?:m(?:l|i|1)|cl|l)\b(?:\s*[·-]?\s*\(?\s*\d+\s*d(?:\.|oses?)?\s*\)?)?/i;

function contientPresentationClaire(value: string | null | undefined): boolean {
  return Boolean(value && PRESENTATION_VETERINAIRE.test(sansAccents(value)));
}

function qualiteEvidence(evidence: unknown): number {
  if (!evidence) return 0;
  const textes = textesEvidence(evidence);
  if (textes.some(contientPresentationClaire)) return 2;
  if (collecterValeursParCle(evidence, "presentation").length > 0) return 1;
  return 0;
}

function quantiteExplicite(candidate: MedicationSelectionCandidate, evidence: unknown): boolean {
  if (collecterValeursParCle(evidence, "deliveredQuantity").some(valeurPositive)) return true;
  return textesEvidence(evidence).some((texte) => /\b(?:qt[eé]|quantit[eé])\s*[:=]?\s*\d+\b/i.test(texte));
}

function scoreCandidate(candidate: MedicationSelectionCandidate): readonly number[] {
  const evidence = lireEvidence(candidate.evidenceJson);
  const conditionnement = candidate.conditionnement?.trim() ?? "";
  return [
    qualiteEvidence(evidence),
    Number(quantiteExplicite(candidate, evidence)),
    Number(contientPresentationClaire(conditionnement) || textesEvidence(evidence).some(contientPresentationClaire)),
    Number(conditionnement.length > 0),
    Number(Boolean(candidate.medicamentId)),
  ];
}

function comparerScores(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function cleMedicamentEquivalent(candidate: MedicationSelectionCandidate): string {
  if (candidate.medicamentId) return `pharmacie:${candidate.medicamentId}`;
  const nom = sansAccents(candidate.nomExtrait)
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `nom:${nom}`;
}

export function selectionnerVersionsMedicaments<T extends MedicationSelectionCandidate>(candidates: readonly T[]): T[] {
  const selections = new Map<string, { candidate: T; score: readonly number[]; index: number }>();
  candidates.forEach((candidate, index) => {
    const key = cleMedicamentEquivalent(candidate);
    if (key === "nom:") return;
    const score = scoreCandidate(candidate);
    const selection = selections.get(key);
    if (!selection || comparerScores(score, selection.score) > 0) {
      selections.set(key, { candidate, score, index: selection?.index ?? index });
    }
  });
  return [...selections.values()]
    .sort((left, right) => left.index - right.index)
    .map(({ candidate }) => candidate);
}

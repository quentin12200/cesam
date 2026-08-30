export interface GenealogyMother {
  id: string;
  nutrav: string;
  nobovi: string | null;
  statut?: string;
}

export interface GenealogyMotherResolution {
  linked: GenealogyMother | null;
  historicalLabel: string | null;
}

export type AncestryParent = "MERE" | "PERE";
export type AncestrySource = "ANIMAL" | "TAUREAU" | "HISTORIQUE" | "VELAGE";

export interface AncestrySearchMatch {
  key: string;
  source: AncestrySource;
  sourceId: string | null;
  workNumber: string | null;
  nationalNumber: string | null;
  name: string | null;
  status?: string | null;
}

export interface AncestryIdentity {
  workNumber: string | null;
  nationalNumber: string | null;
  name: string | null;
  linkedAnimalNutrav: string | null;
}

function identityLabel(number: string | null | undefined, name: string | null | undefined) {
  const values = [number?.trim(), name?.trim()].filter(
    (value): value is string => Boolean(value),
  );
  return [...new Set(values)].join(" ") || null;
}

export function resolveBiologicalMother(input: {
  linkedMother: GenealogyMother | null;
  birthMother: GenealogyMother | null;
  historicalNumber: string | null;
  historicalName: string | null;
}): GenealogyMotherResolution {
  const linked = input.linkedMother ?? input.birthMother;
  return {
    linked,
    historicalLabel: linked
      ? null
      : identityLabel(input.historicalNumber, input.historicalName),
  };
}

export function resolveFatherLabel(input: {
  linkedNumber: string | null;
  linkedName: string | null;
  birthNumber: string | null;
  birthName: string | null;
}): string | null {
  return (
    identityLabel(input.linkedNumber, input.linkedName)
    ?? identityLabel(input.birthNumber, input.birthName)
  );
}

export function resolveParentWorkNumber(input: {
  linkedWorkNumber: string | null;
  historicalMatchedWorkNumber: string | null;
  historicalNationalNumber?: string | null;
  manualWorkNumber: string | null;
}): string | null {
  return input.linkedWorkNumber?.trim()
    || input.historicalMatchedWorkNumber?.trim()
    || workNumberFromHistoricalNational(input.historicalNationalNumber)
    || input.manualWorkNumber?.trim()
    || null;
}

export function canUseAnimalAsParent(input: {
  targetId: string;
  candidateId: string;
  candidateSex: string;
  parent: AncestryParent;
}): boolean {
  return input.candidateId !== input.targetId
    && input.candidateSex === (input.parent === "MERE" ? "F" : "M");
}

export function isSameAncestryIdentity(input: {
  targetWorkNumber: string;
  targetNationalNumbers: Array<string | null | undefined>;
  candidateWorkNumber: string | null | undefined;
  candidateNationalNumber: string | null | undefined;
}): boolean {
  if (input.candidateWorkNumber?.trim() === input.targetWorkNumber.trim()) return true;
  const candidateNational = input.candidateNationalNumber
    ?.replace(/\s+/g, "")
    .replace(/^FR/i, "")
    .toLocaleUpperCase("fr") ?? "";
  return Boolean(candidateNational) && input.targetNationalNumbers.some((value) => (
    value?.replace(/\s+/g, "").replace(/^FR/i, "").toLocaleUpperCase("fr") === candidateNational
  ));
}

export function workNumberFromHistoricalNational(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, "").replace(/^FR/i, "").trim() ?? "";
  return normalized.length >= 4 ? normalized.slice(-4) : null;
}

export function resolveAncestryIdentity(
  candidates: Array<AncestryIdentity | null | undefined>,
): AncestryIdentity | null {
  return candidates.find((candidate) =>
    Boolean(candidate?.workNumber || candidate?.nationalNumber || candidate?.name),
  ) ?? null;
}

export function rankAncestryMatches(
  matches: AncestrySearchMatch[],
  query: string,
): AncestrySearchMatch[] {
  const normalized = query.trim().toLocaleLowerCase("fr");
  const sourceOrder: Record<AncestrySource, number> = {
    ANIMAL: 0,
    TAUREAU: 1,
    HISTORIQUE: 2,
    VELAGE: 3,
  };
  const matchPriority = (match: AncestrySearchMatch) => {
    const work = match.workNumber?.toLocaleLowerCase("fr") ?? "";
    const national = match.nationalNumber
      ?.replace(/\s+/g, "")
      .replace(/^FR/i, "")
      .toLocaleLowerCase("fr") ?? "";
    const compactQuery = normalized.replace(/\s+/g, "").replace(/^fr/i, "");
    const name = match.name?.toLocaleLowerCase("fr") ?? "";
    if (work === normalized) return 0;
    if (national && national === compactQuery) return 1;
    if (national && national.endsWith(compactQuery)) return 2;
    if (name === normalized) return 3;
    return 4;
  };
  return [...matches].sort((left, right) => {
    return matchPriority(left) - matchPriority(right)
      || sourceOrder[left.source] - sourceOrder[right.source]
      || (left.workNumber ?? left.nationalNumber ?? left.name ?? "")
        .localeCompare(right.workNumber ?? right.nationalNumber ?? right.name ?? "", "fr");
  });
}

export function buildAncestryUpdate(input: {
  parent: AncestryParent;
  source: AncestrySource | "MANUEL";
  sourceId: string | null;
  workNumber: string;
  nationalNumber: string | null;
  name: string | null;
}): Record<string, string | null> {
  if (input.parent === "MERE" && input.source === "ANIMAL" && input.sourceId) {
    return { mereId: input.sourceId };
  }
  if (input.parent === "PERE" && input.source === "TAUREAU" && input.sourceId) {
    return { taureauId: input.sourceId };
  }
  const prefix = input.parent === "MERE" ? "mere" : "pere";
  return {
    [`${prefix}TravailManuel`]: input.workNumber.trim(),
    [`${prefix}NationalManuel`]: input.nationalNumber?.trim() || null,
    [`${prefix}NomManuel`]: input.name?.trim() || null,
  };
}

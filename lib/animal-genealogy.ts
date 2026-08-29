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
  manualWorkNumber: string | null;
}): string | null {
  return input.linkedWorkNumber?.trim()
    || input.historicalMatchedWorkNumber?.trim()
    || input.manualWorkNumber?.trim()
    || null;
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
  return [...matches].sort((left, right) => {
    const leftExact = left.workNumber?.toLocaleLowerCase("fr") === normalized ? 0 : 1;
    const rightExact = right.workNumber?.toLocaleLowerCase("fr") === normalized ? 0 : 1;
    return leftExact - rightExact
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

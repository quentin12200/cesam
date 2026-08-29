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

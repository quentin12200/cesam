interface OrdonnanceSourceIdentity {
  id: string;
  extractionId?: string | null;
  photoUrl?: string | null;
  photoUrls?: string | null;
}

interface OrdonnanceListMedication {
  nomExtrait: string;
}

interface OrdonnanceListRow {
  id: string;
  statut: string;
  medicamentNom: string;
  medicaments?: OrdonnanceListMedication[];
  extractionId?: string | null;
  sourceKey: string;
}

function parseDocumentUrls(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((url): url is string => typeof url === "string" && url.length > 0)
      : [];
  } catch {
    return [];
  }
}

export function ordonnanceSourceKey(source: OrdonnanceSourceIdentity): string {
  const documents = parseDocumentUrls(source.photoUrls);
  if (documents.length > 0) return `documents:${JSON.stringify(documents)}`;
  if (source.photoUrl) return `document:${source.photoUrl}`;
  if (source.extractionId) return `extraction:${source.extractionId}`;

  return `ordonnance:${source.id}`;
}

function medicationNames(row: OrdonnanceListRow): OrdonnanceListMedication[] {
  if (row.medicaments && row.medicaments.length > 0) return row.medicaments;
  return row.medicamentNom.trim() ? [{ nomExtrait: row.medicamentNom.trim() }] : [];
}

export function regrouperOrdonnancesPourListe<T extends OrdonnanceListRow>(rows: readonly T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(row.sourceKey);
    if (group) group.push(row);
    else groups.set(row.sourceKey, [row]);
  }

  return Array.from(groups.values(), (group) => {
    const representative = [...group].sort((left, right) => {
      const activeDifference = Number(left.statut === "ARCHIVE") - Number(right.statut === "ARCHIVE");
      if (activeDifference !== 0) return activeDifference;
      const extractionDifference = Number(Boolean(right.extractionId)) - Number(Boolean(left.extractionId));
      if (extractionDifference !== 0) return extractionDifference;
      return medicationNames(right).length - medicationNames(left).length;
    })[0];

    const seen = new Set<string>();
    const medicaments = group.flatMap(medicationNames).filter((medicament) => {
      const key = medicament.nomExtrait.trim().toLocaleLowerCase("fr");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { ...representative, medicaments };
  });
}

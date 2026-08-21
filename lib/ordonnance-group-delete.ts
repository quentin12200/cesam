type OrdonnanceSource = {
  id: string;
  photoUrl: string | null;
  photoUrls: string | null;
  extraction: { id: string } | null;
};

type OrdonnanceAvecLiens = {
  id: string;
  _count: {
    traitements: number;
    vaccinations: number;
  };
};

export interface OrdonnanceGroupDeletePersistence {
  ordonnance: {
    findUnique(args: unknown): Promise<OrdonnanceSource | null>;
    findMany(args: unknown): Promise<OrdonnanceAvecLiens[]>;
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
  extractionOrdonnance: {
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
}

export class OrdonnanceGroupDeleteError extends Error {
  readonly code: "NOT_FOUND" | "LINKED_RECORDS";

  constructor(
    code: "NOT_FOUND" | "LINKED_RECORDS",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "OrdonnanceGroupDeleteError";
  }
}

function contientDesPages(photoUrls: string | null): boolean {
  if (!photoUrls) return false;
  try {
    const parsed = JSON.parse(photoUrls);
    return Array.isArray(parsed) && parsed.some((url) => typeof url === "string" && url.trim());
  } catch {
    return false;
  }
}

function filtreDuGroupe(source: OrdonnanceSource): Record<string, unknown> {
  if (contientDesPages(source.photoUrls)) return { photoUrls: source.photoUrls };
  if (source.photoUrl) return { photoUrl: source.photoUrl };
  if (source.extraction) return { extraction: { id: source.extraction.id } };
  return { id: source.id };
}

export async function supprimerGroupeOrdonnance(
  persistence: OrdonnanceGroupDeletePersistence,
  ordonnanceId: string,
): Promise<{ ordonnanceIds: string[]; count: number }> {
  const source = await persistence.ordonnance.findUnique({
    where: { id: ordonnanceId },
    select: { id: true, photoUrl: true, photoUrls: true, extraction: { select: { id: true } } },
  });
  if (!source) {
    throw new OrdonnanceGroupDeleteError("NOT_FOUND", "Ordonnance non trouvée");
  }

  const ordonnances = await persistence.ordonnance.findMany({
    where: filtreDuGroupe(source),
    select: {
      id: true,
      _count: { select: { traitements: true, vaccinations: true } },
    },
  });
  const ligneLiee = ordonnances.some(
    (ordonnance) => ordonnance._count.traitements > 0 || ordonnance._count.vaccinations > 0,
  );
  if (ligneLiee) {
    throw new OrdonnanceGroupDeleteError(
      "LINKED_RECORDS",
      "Cette ordonnance est liée à des traitements ou vaccinations et ne peut pas être supprimée.",
    );
  }

  const ordonnanceIds = ordonnances.map((ordonnance) => ordonnance.id);
  if (ordonnanceIds.length === 0) {
    throw new OrdonnanceGroupDeleteError("NOT_FOUND", "Ordonnance non trouvée");
  }

  // La relation ExtractionOrdonnance -> Ordonnance n'a pas de cascade : retirer
  // seulement ces brouillons techniques avant les lignes du groupe.
  await persistence.extractionOrdonnance.deleteMany({
    where: { ordonnanceId: { in: ordonnanceIds } },
  });
  const result = await persistence.ordonnance.deleteMany({
    where: { id: { in: ordonnanceIds } },
  });

  return { ordonnanceIds, count: result.count };
}

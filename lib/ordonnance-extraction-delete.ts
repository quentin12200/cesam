const DOCUMENT_PATH_PREFIX = "ordonnances/extractions/";

export interface ExtractionSupprimable {
  id: string;
  statut: string;
  ordonnanceId: string | null;
  documentUrl: string;
  documentUrls: string | null;
}

export interface DocumentReference {
  documentUrl?: string | null;
  documentUrls?: string | null;
  photoUrl?: string | null;
  photoUrls?: string | null;
}

export interface ExtractionDeleteStore {
  findExtraction(id: string): Promise<ExtractionSupprimable | null>;
  deletePendingExtraction(id: string): Promise<number>;
  listRemainingExtractionDocuments(): Promise<DocumentReference[]>;
  listOrdonnanceDocuments(): Promise<DocumentReference[]>;
}

export class ExtractionDeleteError extends Error {
  readonly code: "NOT_FOUND" | "PROTECTED";

  constructor(
    code: "NOT_FOUND" | "PROTECTED",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

function urlsReference(reference: DocumentReference): { urls: string[]; jsonInvalide: boolean } {
  const urls = [reference.documentUrl, reference.photoUrl].filter((url): url is string => Boolean(url));
  for (const json of [reference.documentUrls, reference.photoUrls]) {
    if (!json) continue;
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return { urls, jsonInvalide: true };
      urls.push(...parsed.filter((url): url is string => typeof url === "string"));
    } catch {
      return { urls, jsonInvalide: true };
    }
  }
  return { urls, jsonInvalide: false };
}

export function documentStoragePath(url: string): string | null {
  try {
    const parsed = new URL(url, "https://cesam.local");
    if (parsed.pathname !== "/api/documents/ordonnances") return null;
    const path = parsed.searchParams.get("path") ?? "";
    if (!path.startsWith(DOCUMENT_PATH_PREFIX) || path.includes("..")) return null;
    return path;
  } catch {
    return null;
  }
}

function storagePaths(references: DocumentReference[]): { paths: Set<string>; jsonInvalide: boolean } {
  const paths = new Set<string>();
  let jsonInvalide = false;
  for (const reference of references) {
    const parsed = urlsReference(reference);
    jsonInvalide ||= parsed.jsonInvalide;
    for (const url of parsed.urls) {
      const path = documentStoragePath(url);
      if (path) paths.add(path);
    }
  }
  return { paths, jsonInvalide };
}

export async function supprimerExtractionAVerifier({
  id,
  store,
  deleteDocument,
}: {
  id: string;
  store: ExtractionDeleteStore;
  deleteDocument: (path: string) => Promise<void>;
}): Promise<{ documentsSupprimes: string[]; documentsConserves: string[]; nettoyageIncomplet: string[] }> {
  const extraction = await store.findExtraction(id);
  if (!extraction) throw new ExtractionDeleteError("NOT_FOUND", "Ordonnance à vérifier introuvable");
  if (extraction.statut !== "A_VERIFIER" || extraction.ordonnanceId) {
    throw new ExtractionDeleteError(
      "PROTECTED",
      "Une ordonnance déjà validée ou intégrée ne peut pas être supprimée depuis cette action",
    );
  }

  const deleted = await store.deletePendingExtraction(id);
  if (deleted !== 1) {
    throw new ExtractionDeleteError(
      "PROTECTED",
      "L’ordonnance a été validée entre-temps et ne peut plus être supprimée",
    );
  }

  const cible = storagePaths([{
    documentUrl: extraction.documentUrl,
    documentUrls: extraction.documentUrls,
  }]);
  let referencesRestantes: ReturnType<typeof storagePaths>;
  try {
    referencesRestantes = storagePaths([
      ...await store.listRemainingExtractionDocuments(),
      ...await store.listOrdonnanceDocuments(),
    ]);
  } catch {
    return {
      documentsSupprimes: [],
      documentsConserves: [],
      nettoyageIncomplet: [...cible.paths],
    };
  }
  const conservationForcee = cible.jsonInvalide || referencesRestantes.jsonInvalide;
  const exclusifs = conservationForcee
    ? []
    : [...cible.paths].filter((path) => !referencesRestantes.paths.has(path));
  const documentsConserves = [...cible.paths].filter((path) => (
    conservationForcee || referencesRestantes.paths.has(path)
  ));
  const results = await Promise.allSettled(exclusifs.map((path) => deleteDocument(path)));
  const documentsSupprimes = exclusifs.filter((_, index) => results[index].status === "fulfilled");
  const nettoyageIncomplet = exclusifs.filter((_, index) => results[index].status === "rejected");

  return { documentsSupprimes, documentsConserves, nettoyageIncomplet };
}

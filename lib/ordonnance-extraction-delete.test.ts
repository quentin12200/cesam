import assert from "node:assert/strict";
import test from "node:test";
import {
  ExtractionDeleteError,
  supprimerExtractionAVerifier,
  type DocumentReference,
  type ExtractionDeleteStore,
  type ExtractionSupprimable,
} from "./ordonnance-extraction-delete.ts";

const documentA = "/api/documents/ordonnances?path=ordonnances%2Fextractions%2Fdocument-a.jpg";
const documentB = "/api/documents/ordonnances?path=ordonnances%2Fextractions%2Fdocument-b.jpg";

function creerStore({
  extraction,
  autresExtractions = [],
  ordonnances = [],
}: {
  extraction: ExtractionSupprimable | null;
  autresExtractions?: DocumentReference[];
  ordonnances?: DocumentReference[];
}) {
  let temporaire = extraction;
  let suppressions = 0;
  const store: ExtractionDeleteStore = {
    findExtraction: async () => temporaire,
    deletePendingExtraction: async () => {
      if (!temporaire || temporaire.statut !== "A_VERIFIER" || temporaire.ordonnanceId) return 0;
      temporaire = null;
      suppressions += 1;
      return 1;
    },
    listRemainingExtractionDocuments: async () => autresExtractions,
    listOrdonnanceDocuments: async () => ordonnances,
  };
  return {
    store,
    get temporaire() { return temporaire; },
    get suppressions() { return suppressions; },
  };
}

function extraction(overrides: Partial<ExtractionSupprimable> = {}): ExtractionSupprimable {
  return {
    id: "extraction-1",
    statut: "A_VERIFIER",
    ordonnanceId: null,
    documentUrl: documentA,
    documentUrls: JSON.stringify([documentA, documentB]),
    ...overrides,
  };
}

test("supprime toute l'extraction temporaire a verifier et ses documents exclusifs", async () => {
  const donnees = creerStore({ extraction: extraction() });
  const fichiersSupprimes: string[] = [];
  const resultat = await supprimerExtractionAVerifier({
    id: "extraction-1",
    store: donnees.store,
    deleteDocument: async (path) => { fichiersSupprimes.push(path); },
  });

  assert.equal(donnees.temporaire, null);
  assert.equal(donnees.suppressions, 1);
  assert.deepEqual(fichiersSupprimes.sort(), [
    "ordonnances/extractions/document-a.jpg",
    "ordonnances/extractions/document-b.jpg",
  ]);
  assert.equal(resultat.nettoyageIncomplet.length, 0);
});

test("refuse une extraction deja validee sans toucher aux donnees sanitaires", async () => {
  const donnees = creerStore({
    extraction: extraction({ statut: "VALIDEE", ordonnanceId: "ordonnance-1" }),
    ordonnances: [{ photoUrl: documentA }],
  });
  let documentSupprime = false;

  await assert.rejects(
    supprimerExtractionAVerifier({
      id: "extraction-1",
      store: donnees.store,
      deleteDocument: async () => { documentSupprime = true; },
    }),
    (error: unknown) => error instanceof ExtractionDeleteError && error.code === "PROTECTED",
  );
  assert.equal(donnees.suppressions, 0);
  assert.equal(donnees.temporaire?.ordonnanceId, "ordonnance-1");
  assert.equal(documentSupprime, false);
});

test("refuse aussi un lien vers une ordonnance meme si le statut est incoherent", async () => {
  const donnees = creerStore({
    extraction: extraction({ statut: "A_VERIFIER", ordonnanceId: "ordonnance-sanitaire" }),
  });
  await assert.rejects(
    supprimerExtractionAVerifier({
      id: "extraction-1",
      store: donnees.store,
      deleteDocument: async () => undefined,
    }),
    (error: unknown) => error instanceof ExtractionDeleteError && error.code === "PROTECTED",
  );
  assert.equal(donnees.suppressions, 0);
});

test("conserve un document partage avec une autre extraction", async () => {
  const donnees = creerStore({
    extraction: extraction({ documentUrls: JSON.stringify([documentA]) }),
    autresExtractions: [{ documentUrl: documentA }],
  });
  const fichiersSupprimes: string[] = [];
  const resultat = await supprimerExtractionAVerifier({
    id: "extraction-1",
    store: donnees.store,
    deleteDocument: async (path) => { fichiersSupprimes.push(path); },
  });
  assert.deepEqual(fichiersSupprimes, []);
  assert.deepEqual(resultat.documentsConserves, ["ordonnances/extractions/document-a.jpg"]);
});

test("conserve un document repris par une ordonnance durable", async () => {
  const donnees = creerStore({
    extraction: extraction({ documentUrls: JSON.stringify([documentA]) }),
    ordonnances: [{ photoUrl: documentA, photoUrls: JSON.stringify([documentA]) }],
  });
  let documentSupprime = false;
  const resultat = await supprimerExtractionAVerifier({
    id: "extraction-1",
    store: donnees.store,
    deleteDocument: async () => { documentSupprime = true; },
  });
  assert.equal(documentSupprime, false);
  assert.equal(resultat.documentsConserves.length, 1);
});

test("une reference illisible interdit par securite la suppression physique", async () => {
  const donnees = creerStore({
    extraction: extraction({ documentUrls: JSON.stringify([documentA]) }),
    autresExtractions: [{ documentUrls: "JSON_INVALIDE" }],
  });
  let documentSupprime = false;
  const resultat = await supprimerExtractionAVerifier({
    id: "extraction-1",
    store: donnees.store,
    deleteDocument: async () => { documentSupprime = true; },
  });
  assert.equal(documentSupprime, false);
  assert.deepEqual(resultat.documentsConserves, ["ordonnances/extractions/document-a.jpg"]);
});

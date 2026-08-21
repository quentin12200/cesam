import assert from "node:assert/strict";
import test from "node:test";
import {
  OrdonnanceGroupDeleteError,
  supprimerGroupeOrdonnance,
  type OrdonnanceGroupDeletePersistence,
} from "./ordonnance-group-delete.ts";

function persistenceEnMemoire(options?: { linkedId?: string; linkedType?: "traitement" | "vaccination" }) {
  const lignes = ["ord-1", "ord-2"];
  const suppressions = { extractions: [] as string[], ordonnances: [] as string[] };
  const persistence: OrdonnanceGroupDeletePersistence = {
    ordonnance: {
      async findUnique() {
        return {
          id: "ord-1",
          photoUrl: "page-1.jpg",
          photoUrls: '["page-1.jpg","page-2.jpg"]',
          extraction: { id: "extraction-1" },
        };
      },
      async findMany() {
        return lignes.map((id) => ({
          id,
          _count: {
            traitements: id === options?.linkedId && options.linkedType !== "vaccination" ? 1 : 0,
            vaccinations: id === options?.linkedId && options.linkedType === "vaccination" ? 1 : 0,
          },
        }));
      },
      async deleteMany(args) {
        const ids = (args as { where: { id: { in: string[] } } }).where.id.in;
        suppressions.ordonnances.push(...ids);
        return { count: ids.length };
      },
    },
    extractionOrdonnance: {
      async deleteMany(args) {
        const ids = (args as { where: { ordonnanceId: { in: string[] } } }).where.ordonnanceId.in;
        suppressions.extractions.push(...ids);
        return { count: ids.length };
      },
    },
  };
  return { persistence, suppressions };
}

test("supprime toutes les lignes du même document et leurs extractions temporaires", async () => {
  const { persistence, suppressions } = persistenceEnMemoire();

  const result = await supprimerGroupeOrdonnance(persistence, "ord-1");

  assert.deepEqual(result.ordonnanceIds, ["ord-1", "ord-2"]);
  assert.equal(result.count, 2);
  assert.deepEqual(suppressions.extractions, ["ord-1", "ord-2"]);
  assert.deepEqual(suppressions.ordonnances, ["ord-1", "ord-2"]);
});

test("refuse tout le groupe si une ligne est liée à un traitement ou une vaccination", async () => {
  for (const linkedType of ["traitement", "vaccination"] as const) {
    const { persistence, suppressions } = persistenceEnMemoire({ linkedId: "ord-2", linkedType });

    await assert.rejects(
      supprimerGroupeOrdonnance(persistence, "ord-1"),
      (error: unknown) => error instanceof OrdonnanceGroupDeleteError && error.code === "LINKED_RECORDS",
    );
    assert.deepEqual(suppressions.extractions, []);
    assert.deepEqual(suppressions.ordonnances, []);
  }
});

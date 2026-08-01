import assert from "node:assert/strict";
import test from "node:test";
import {
  createFieldWeight,
  deleteFieldWeight,
  updateFieldWeight,
} from "./field-weighing-api.ts";
import type { FieldSessionEntry } from "./field-weighing.ts";

const entry: FieldSessionEntry = {
  id: "p1",
  nutrav: "9260",
  mereNutrav: "6393",
  birthDate: "2025-09-01T00:00:00.000Z",
  sexe: "M",
  poids: 348,
  gmq: 1.2,
  selected: true,
};

function jsonFetcher(body: unknown, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
}

test("crée une entrée de séance depuis la réponse canonique", async () => {
  const created = await createFieldWeight(
    { nutrav: "9260", poids: 348, date: "2026-08-01", sessionStartedAt: "2026-08-01T07:00:00.000Z" },
    jsonFetcher({
      pesee: { id: "p1", poids: 348 },
      animal: { nutrav: "9260", sexe: "M", mereNutrav: "6393", birthDate: entry.birthDate },
      gmq: 1.2,
    }),
  );

  assert.deepEqual(created, entry);
});

test("PATCH remplace seulement la pesée existante", async () => {
  const updated = await updateFieldWeight(
    entry,
    360,
    "2026-08-01T07:00:00.000Z",
    jsonFetcher({ pesee: { id: "p1", poids: 360 }, gmq: 1.4 }),
  );

  assert.deepEqual(updated, { ...entry, poids: 360, gmq: 1.4 });
});

test("une erreur serveur laisse les données locales intactes", async () => {
  const entries = [entry];
  await assert.rejects(
    deleteFieldWeight(
      "p1",
      jsonFetcher({ error: "Suppression refusée" }, 500),
    ),
    /Suppression refusée/,
  );
  assert.deepEqual(entries, [entry]);
});

test("DELETE utilise l'id canonique de la pesée", async () => {
  let requestedUrl = "";
  let requestedMethod = "";
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedMethod = init?.method ?? "GET";
    return new Response(JSON.stringify({ success: true, id: "p1" }), { status: 200 });
  }) as typeof fetch;

  await deleteFieldWeight("p1", fetcher);
  assert.equal(requestedUrl, "/api/pesees/p1");
  assert.equal(requestedMethod, "DELETE");
});

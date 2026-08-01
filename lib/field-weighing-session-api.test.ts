import assert from "node:assert/strict";
import test from "node:test";
import {
  attachLegacyFieldSession,
  openActiveFieldSession,
  saveFieldSessionMetadata,
  sessionFromServer,
  transitionFieldSession,
  type ServerWeighingSession,
} from "./field-weighing-session-api.ts";
import { createFieldSession } from "./field-weighing-session.ts";

const entry = {
  id: "p1",
  nutrav: "9260",
  sexe: "M" as const,
  poids: 348,
  gmq: 1.2,
  selected: true,
};

const server: ServerWeighingSession = {
  id: "ws1",
  startedAt: "2026-08-01T08:00:00.000Z",
  endedAt: null,
  status: "ACTIVE",
  selectionData: { selectedPeseeIds: ["p1"], summaryOpen: true, simulationOpen: false },
  simulationData: { priceGroups: [{ id: "g1", sexe: "M", peseeIds: ["p1"], mode: "PER_HEAD", tarif: 900 }] },
  fieldEntries: [entry],
};

function sequenceFetcher(responses: unknown[], requests: Array<{ url: string; init?: RequestInit }>): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify(responses.shift()), { status: 200 });
  }) as typeof fetch;
}

test("ouvre puis charge la séance active canonique", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await openActiveFieldSession(sequenceFetcher([{ id: "ws1" }, server], requests));
  assert.equal(result.id, "ws1");
  assert.deepEqual(requests.map((request) => [request.url, request.init?.method]), [
    ["/api/weighing-sessions", "POST"],
    ["/api/weighing-sessions/ws1", undefined],
  ]);
});

test("rattache uniquement les ids exacts de l’ancienne séance", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  await attachLegacyFieldSession("ws1", ["p1", "p2"], sequenceFetcher([{ attached: ["p1"], ignored: ["p2"] }], requests));
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), { peseeIds: ["p1", "p2"] });
});

test("reconstruit un autre appareil depuis les données serveur", () => {
  const restored = sessionFromServer(server);
  assert.equal(restored.weighingSessionId, "ws1");
  assert.equal(restored.startedAt, server.startedAt);
  assert.equal(restored.entries[0].selected, true);
  assert.deepEqual(restored.priceGroups[0].peseeIds, ["p1"]);
});

test("préserve le cache du même appareil pendant la réconciliation", () => {
  const cached = {
    ...createFieldSession(new Date(server.startedAt), "ws1"),
    entries: [{ ...entry, selected: false }],
    pendingWeights: [{ localId: "local", nutrav: "9261", poids: 320, date: "2026-08-01" }],
  };
  const restored = sessionFromServer(server, cached);
  assert.equal(restored.entries[0].selected, false);
  assert.equal(restored.pendingWeights.length, 1);
});

test("ignore les références de groupe invalides sans perdre le groupe valide", () => {
  const cached = {
    ...createFieldSession(new Date(server.startedAt), "ws1"),
    entries: [entry],
    priceGroups: [{ id: "g1", sexe: "M" as const, peseeIds: ["p1", "absente"], mode: "PER_HEAD" as const, tarif: 900 }],
  };
  const restored = sessionFromServer(server, cached);
  assert.deepEqual(restored.priceGroups[0].peseeIds, ["p1"]);
});

test("une séance terminée depuis un autre appareil revient en lecture seule", () => {
  const finished = sessionFromServer({
    ...server,
    status: "FINISHED",
    endedAt: "2026-08-01T10:00:00.000Z",
    selectionData: { selectedPeseeIds: ["p1"], summaryOpen: false },
  });
  assert.equal(finished.status, "FINISHED");
  assert.equal(finished.summaryOpen, true);
});

test("synchronise les choix utiles sans données métier recalculables", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const local = sessionFromServer(server);
  await saveFieldSessionMetadata(local, sequenceFetcher([server], requests));
  const body = JSON.parse(String(requests[0].init?.body));
  assert.deepEqual(body.selectedPeseeIds, ["p1"]);
  assert.equal("poids" in body, false);
  assert.equal("gmq" in body, false);
  assert.equal("entries" in body, false);
});

test("fin et abandon utilisent des actions distinctes", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = sequenceFetcher([
    { ...server, status: "FINISHED", endedAt: "2026-08-01T10:00:00.000Z" },
    { ...server, status: "ABANDONED", endedAt: "2026-08-01T10:00:00.000Z" },
  ], requests);
  await transitionFieldSession("ws1", "finish", fetcher);
  await transitionFieldSession("ws1", "abandon", fetcher);
  assert.deepEqual(requests.map((request) => request.url), [
    "/api/weighing-sessions/ws1/finish",
    "/api/weighing-sessions/ws1/abandon",
  ]);
});

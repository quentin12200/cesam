import assert from "node:assert/strict";
import test from "node:test";
import { createFieldSession } from "./field-weighing-session.ts";
import { resolveHomeWeighingView } from "./home-weighing.ts";

const startedAt = "2026-08-01T08:00:00.000Z";

test("accueil sans séance active propose un état vide stable", () => {
  assert.deepEqual(resolveHomeWeighingView(null, createFieldSession(new Date(startedAt)), false), {
    active: null,
    pendingCount: 0,
    offline: false,
  });
});

test("accueil avec séance active affiche son effectif", () => {
  const view = resolveHomeWeighingView({ id: "ws1", startedAt, count: 6 }, null, false);
  assert.equal(view.active?.count, 6);
  assert.equal(view.active?.id, "ws1");
});

test("hors connexion reprend le cache et ses pesées en attente", () => {
  const cached = {
    ...createFieldSession(new Date(startedAt), "ws1"),
    entries: [{ id: "p1", nutrav: "9260", sexe: "M" as const, poids: 348, gmq: null, selected: true }],
    pendingWeights: [{ localId: "local", nutrav: "9261", poids: 350, date: "2026-08-01" }],
  };
  const view = resolveHomeWeighingView(null, cached, true);
  assert.equal(view.active?.count, 1);
  assert.equal(view.pendingCount, 1);
  assert.equal(view.offline, true);
});

test("le cache d’une autre séance ne modifie pas l’état serveur", () => {
  const cached = { ...createFieldSession(new Date(startedAt), "old"), pendingWeights: [{ localId: "local", nutrav: "1", poids: 300, date: "2026-08-01" }] };
  const view = resolveHomeWeighingView({ id: "ws1", startedAt, count: 2 }, cached, false);
  assert.equal(view.active?.count, 2);
  assert.equal(view.pendingCount, 0);
});

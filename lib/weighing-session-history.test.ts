import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateWeighingSessionIndicators,
  isHistorySessionReadOnly,
  parseHistoryPriceGroups,
  sortWeighingSessionsNewestFirst,
  statusLabel,
  WEIGHING_SESSION_FILTERS,
} from "./weighing-session-history.ts";

test("calcule effectifs, sexes, poids moyen et GMQ moyen", () => {
  const result = calculateWeighingSessionIndicators([
    { sexe: "M", poids: 463, gmq: 1.2 },
    { sexe: "M", poids: 457, gmq: null },
    { sexe: "F", poids: 400, gmq: 0.8 },
  ]);
  assert.deepEqual(result, {
    count: 3,
    males: 2,
    females: 1,
    averageWeight: 440,
    averageGmq: 1,
  });
});

test("ouvre les séances terminées et abandonnées en lecture seule", () => {
  assert.equal(isHistorySessionReadOnly("ACTIVE"), false);
  assert.equal(isHistorySessionReadOnly("FINISHED"), true);
  assert.equal(isHistorySessionReadOnly("ABANDONED"), true);
});

test("restaure les groupes et tarifs de la simulation enregistrée", () => {
  const groups = parseHistoryPriceGroups({
    priceGroups: [{ id: "g1", sexe: "M", peseeIds: ["p1"], mode: "PER_KG", tarif: 5.2 }],
  });
  assert.deepEqual(groups, [{ id: "g1", sexe: "M", peseeIds: ["p1"], mode: "PER_KG", tarif: 5.2 }]);
});

test("trie les séances de la plus récente à la plus ancienne", () => {
  const sorted = sortWeighingSessionsNewestFirst([
    { id: "old", startedAt: "2026-07-01T08:00:00.000Z" },
    { id: "new", startedAt: "2026-08-01T08:00:00.000Z" },
  ]);
  assert.deepEqual(sorted.map((session) => session.id), ["new", "old"]);
});

test("propose uniquement les quatre filtres simples", () => {
  assert.deepEqual(WEIGHING_SESSION_FILTERS.map((filter) => filter.label), [
    "Toutes", "En cours", "Terminées", "Abandonnées",
  ]);
});

test("indique un GMQ indisponible sans référence fiable", () => {
  const result = calculateWeighingSessionIndicators([{ sexe: "F", poids: 341, gmq: null }]);
  assert.equal(result.averageWeight, 341);
  assert.equal(result.averageGmq, null);
});

test("affiche les trois statuts sans assimiler l’abandon à une suppression", () => {
  assert.equal(statusLabel("ACTIVE"), "En cours");
  assert.equal(statusLabel("FINISHED"), "Terminée");
  assert.equal(statusLabel("ABANDONED"), "Abandonnée");
});

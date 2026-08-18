import assert from "node:assert/strict";
import test from "node:test";
import {
  createFieldSession,
  addPendingWeight,
  canResumeFieldSession,
  canStartNewFieldSession,
  mergeServerEntries,
  parseStoredFieldSession,
  removeFieldSessionEntry,
  resolvePendingWeight,
} from "./field-weighing-session.ts";

const now = new Date("2026-08-01T08:00:00.000Z");
const entry = {
  id: "p1",
  nutrav: "9260",
  sexe: "M" as const,
  poids: 348,
  gmq: 1.2,
  selected: true,
};

test("crée une séance locale vide et documentée", () => {
  assert.deepEqual(createFieldSession(now), {
    weighingSessionId: null,
    startedAt: now.toISOString(),
    status: "ACTIVE",
    entries: [],
    pendingWeights: [],
    summaryOpen: false,
    simulationOpen: false,
    priceGroups: [],
  });
});

test("interdit une nouvelle séance tant que la séance courante est active", () => {
  assert.equal(canStartNewFieldSession("ACTIVE"), false);
  assert.equal(canStartNewFieldSession("FINISHED"), true);
  assert.equal(canStartNewFieldSession("ABANDONED"), true);
});

test("reprend uniquement une véritable séance active", () => {
  assert.equal(canResumeFieldSession("ACTIVE"), true);
  assert.equal(canResumeFieldSession("FINISHED"), false);
  assert.equal(canResumeFieldSession("ABANDONED"), false);
});

test("restaure une ancienne structure sans identifiant de séance", () => {
  const restored = parseStoredFieldSession(JSON.stringify({
    startedAt: now.toISOString(),
    entries: [entry],
    summaryOpen: true,
    priceGroups: [{ id: "g1", sexe: "M", peseeIds: ["p1"], mode: "PER_HEAD", tarif: 900 }],
  }), now);
  assert.equal(restored.weighingSessionId, null);
  assert.equal(restored.status, "ACTIVE");
  assert.equal(restored.summaryOpen, true);
  assert.deepEqual(restored.priceGroups[0].peseeIds, ["p1"]);
});

test("restaure une ancienne séance et conserve les détails à réhydrater", () => {
  const restored = parseStoredFieldSession(JSON.stringify({
    startedAt: now.toISOString(),
    entries: [entry],
  }), now);

  assert.equal(restored.entries.length, 1);
  assert.equal(restored.entries[0].mereNutrav, undefined);
  assert.equal(restored.entries[0].birthDate, undefined);
});

test("nettoie une séance corrompue sans dupliquer les pesées", () => {
  const restored = parseStoredFieldSession(JSON.stringify({
    startedAt: "invalide",
    entries: [entry, { ...entry }, { ...entry, id: "p2" }, { id: 12 }],
    priceGroups: [
      { id: "g1", sexe: "M", peseeIds: ["p1", "absente"], mode: "PER_KG", tarif: 5 },
      { id: "g2", sexe: "M", peseeIds: ["p1"], mode: "PER_HEAD", tarif: 900 },
    ],
  }), now);

  assert.equal(restored.startedAt, now.toISOString());
  assert.deepEqual(restored.entries.map((item) => item.id), ["p1"]);
  assert.deepEqual(restored.priceGroups[0].peseeIds, ["p1"]);
  assert.equal(restored.priceGroups.length, 1);
});

test("une valeur illisible recrée seulement la séance locale", () => {
  assert.deepEqual(parseStoredFieldSession("{", now), createFieldSession(now));
});

test("la suppression locale cible un id et synchronise les groupes", () => {
  const session = {
    ...createFieldSession(now),
    entries: [entry, { ...entry, id: "p2", nutrav: "9261" }],
    priceGroups: [{ id: "g1", sexe: "M" as const, peseeIds: ["p1", "p2"], mode: "PER_HEAD" as const, tarif: 900 }],
  };
  const updated = removeFieldSessionEntry(session, "p1");

  assert.deepEqual(updated.entries.map((item) => item.id), ["p2"]);
  assert.deepEqual(updated.priceGroups[0].peseeIds, ["p2"]);
  assert.equal(session.entries.length, 2);
});

test("la séance validée reste identique après sérialisation", () => {
  const session = { ...createFieldSession(now), entries: [entry] };
  assert.deepEqual(parseStoredFieldSession(JSON.stringify(session), now), session);
});

test("la réconciliation serveur conserve les sélections et groupes valides", () => {
  const local = {
    ...createFieldSession(now, "ws1"),
    entries: [entry],
    priceGroups: [{ id: "g1", sexe: "M" as const, peseeIds: ["p1"], mode: "PER_HEAD" as const, tarif: 900 }],
  };
  const merged = mergeServerEntries(local, [{ ...entry, poids: 360 }]);
  assert.equal(merged.entries[0].poids, 360);
  assert.equal(merged.entries[0].selected, true);
  assert.deepEqual(merged.priceGroups[0].peseeIds, ["p1"]);
});

test("une pesée hors connexion est conservée puis résolue sans doublon", () => {
  const pending = { localId: "local-1", nutrav: "9260", poids: 348, date: "2026-08-01" };
  const queued = addPendingWeight(createFieldSession(now, "ws1"), pending);
  const duplicate = addPendingWeight(queued, { ...pending, localId: "local-2" });
  const resolved = resolvePendingWeight(duplicate, pending.localId, entry);
  assert.equal(duplicate.pendingWeights.length, 1);
  assert.deepEqual(resolved.entries.map((item) => item.id), ["p1"]);
  assert.equal(resolved.pendingWeights.length, 0);
});

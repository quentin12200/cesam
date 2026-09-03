import assert from "node:assert/strict";
import test from "node:test";
import {
  buildManualEchoRequestData,
  findActiveManualEchoRequest,
  getObsoleteAutomaticEchoRequestIds,
} from "./echo-request-state.ts";

test("l'ajout manuel enregistre tous les champs de la demande active", () => {
  const now = new Date("2026-09-03T08:00:00Z");
  assert.deepEqual(buildManualEchoRequestData({
    animalId: "vache-vide",
    saillieId: null,
    now,
  }), {
    animalId: "vache-vide",
    saillieId: null,
    origine: "MANUELLE",
    etat: "A_FAIRE",
    motif: null,
    planifieeAt: now,
    observation: null,
    requestKey: "MANUAL_ACTIVE:vache-vide",
  });
});

test("une demande automatique active ne remplace pas l'ordre manuel", () => {
  assert.equal(findActiveManualEchoRequest([
    { id: "auto", origine: "AUTOMATIQUE", etat: "A_FAIRE" },
  ]), undefined);
  assert.equal(findActiveManualEchoRequest([
    { id: "auto", origine: "AUTOMATIQUE", etat: "A_FAIRE" },
    { id: "manual", origine: "MANUELLE", etat: "A_FAIRE" },
  ])?.id, "manual");
});

test("la synchronisation automatique ne retire jamais une demande manuelle active", () => {
  const obsolete = getObsoleteAutomaticEchoRequestIds([
    { id: "auto-old", animalId: "vache-vide", saillieId: "old", origine: "AUTOMATIQUE" },
    { id: "manual", animalId: "vache-vide", saillieId: "old", origine: "MANUELLE" },
  ], new Map([["vache-vide", "current"]]));

  assert.deepEqual(obsolete, ["auto-old"]);
});

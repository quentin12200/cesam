import assert from "node:assert/strict";
import test from "node:test";
import { BOUCLAGE_POPULATION, bouclageInfo } from "./bouclage.ts";

test("la population reste celle d’Identification : actif et vêlage CESAM lié", () => {
  assert.deepEqual(BOUCLAGE_POPULATION, { statut: "ACTIF", velageVeau: { isNot: null } });
  assert.deepEqual(bouclageInfo({ statut: "ACTIF", boucleFaite: false, velageVeau: { id: "v1" } }), { boucleFaite: false, estConcerneParBouclage: true });
  assert.deepEqual(bouclageInfo({ statut: "ACTIF", boucleFaite: true, velageVeau: { id: "v1" } }), { boucleFaite: true, estConcerneParBouclage: true });
});

test("un ancien animal sans vêlage d’origine ou un animal sorti n’est pas signalé", () => {
  for (const boucleFaite of [false, true]) {
    assert.equal(bouclageInfo({ statut: "ACTIF", boucleFaite, velageVeau: null }).estConcerneParBouclage, false);
    assert.equal(bouclageInfo({ statut: "SORTI", boucleFaite, velageVeau: { id: "v1" } }).estConcerneParBouclage, false);
  }
});

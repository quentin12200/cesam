import assert from "node:assert/strict";
import test from "node:test";
import { addMonths } from "date-fns";
import { isNeverWeighedAnimal, neverWeighedAnimalWhere, shouldShowActiveWeighingNews } from "./weighing-news.ts";

const now = new Date("2026-08-01T12:00:00.000Z");
const threshold = addMonths(now, -10);

test("une séance active avec pesées apparaît dans les actualités", () => {
  assert.equal(shouldShowActiveWeighingNews({ status: "ACTIVE", weightCount: 3 }), true);
  assert.equal(shouldShowActiveWeighingNews({ status: "ACTIVE", weightCount: 0 }), false);
});

test("une séance terminée ou abandonnée ne paraît pas dans les actualités", () => {
  assert.equal(shouldShowActiveWeighingNews({ status: "FINISHED", weightCount: 3 }), false);
  assert.equal(shouldShowActiveWeighingNews({ status: "ABANDONED", weightCount: 3 }), false);
});

test("retient un animal actif de dix mois exactement sans pesée", () => {
  assert.equal(isNeverWeighedAnimal({ statut: "ACTIF", danais: threshold, weightCount: 0 }, threshold), true);
});

test("exclut un veau de moins de dix mois et un animal déjà pesé", () => {
  assert.equal(isNeverWeighedAnimal({ statut: "ACTIF", danais: addMonths(threshold, 1), weightCount: 0 }, threshold), false);
  assert.equal(isNeverWeighedAnimal({ statut: "ACTIF", danais: threshold, weightCount: 1 }, threshold), false);
});

test("exclut tous les statuts non présents dans l’exploitation", () => {
  for (const statut of ["MORT", "SORTI", "VENDU", "ARCHIVE"]) {
    assert.equal(isNeverWeighedAnimal({ statut, danais: threshold, weightCount: 0 }, threshold), false);
  }
});

test("disparaît du groupe après sa première pesée", () => {
  const animal = { statut: "ACTIF", danais: threshold, weightCount: 0 };
  assert.equal(isNeverWeighedAnimal(animal, threshold), true);
  assert.equal(isNeverWeighedAnimal({ ...animal, weightCount: 1 }, threshold), false);
});

test("la requête canonique exige ACTIF, dix mois et aucune pesée", () => {
  assert.deepEqual(neverWeighedAnimalWhere(now), {
    statut: "ACTIF",
    danais: { lte: threshold },
    pesees: { none: {} },
  });
});

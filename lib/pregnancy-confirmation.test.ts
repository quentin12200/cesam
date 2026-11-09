import test from "node:test";
import assert from "node:assert/strict";
import { supersededPregnancyIds } from "./pregnancy-confirmation.ts";

test("ancienne gestation confirmée remplacée", () => {
  assert.deepEqual(supersededPregnancyIds([{ id: "ancienne", etat: "VERT" }], "nouvelle"), ["ancienne"]);
});
test("conserve la gestation en cours de confirmation", () => {
  assert.deepEqual(supersededPregnancyIds([{ id: "actuelle", etat: "VERT" }], "actuelle"), []);
});
test("ne modifie pas les tentatives non confirmées ou négatives", () => {
  assert.deepEqual(supersededPregnancyIds([
    { id: "essai", etat: "GRIS" }, { id: "negative", etat: "ROUGE" },
    { id: "ancienne", etat: "VERT" },
  ], "nouvelle"), ["ancienne"]);
});
test("aucune gestation antérieure", () => {
  assert.deepEqual(supersededPregnancyIds([], "nouvelle"), []);
});

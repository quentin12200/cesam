import assert from "node:assert/strict";
import test from "node:test";
import { groupedSaleTotal, toggleAnimalSelection, uniqueAnimalIds } from "./grouped-sale.ts";

test("présélectionne chaque animal une seule fois", () => {
  assert.deepEqual(uniqueAnimalIds(["veau-1", "veau-2", "veau-1"]), ["veau-1", "veau-2"]);
});

test("permet de décocher puis d'ajouter un animal", () => {
  assert.deepEqual(toggleAnimalSelection(["veau-1", "veau-2"], "veau-1"), ["veau-2"]);
  assert.deepEqual(toggleAnimalSelection(["veau-2"], "veau-3"), ["veau-2", "veau-3"]);
});

test("calcule le total avec le poids propre à chaque animal", () => {
  assert.equal(groupedSaleTotal(["veau-1", "veau-2"], { "veau-1": "310", "veau-2": "290" }, "3.50"), 2100);
});

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

test("une vente groupée fictive ne compte pas deux fois le même veau", () => {
  const ids = uniqueAnimalIds(["veau-A", "veau-B", "veau-A"]);
  assert.equal(ids.length, 2);
  assert.equal(groupedSaleTotal(ids, { "veau-A": "350", "veau-B": "420" }, "4.80"), 3696);
});

test("une vente groupée sans poids exploitable n'invente pas de montant", () => {
  assert.equal(groupedSaleTotal(["veau-A"], { "veau-A": "" }, "4.80"), null);
  assert.equal(groupedSaleTotal(["veau-A"], { "veau-A": "350" }, "0"), null);
});

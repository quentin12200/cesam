import assert from "node:assert/strict";
import test from "node:test";
import { parsePersistentAnimalSelection, parseTroupeauMobileTablePreferences } from "./troupeau-mobile-table.ts";

test("le tableau mobile affiche seulement numéro, sexe et âge par défaut", () => {
  assert.deepEqual(parseTroupeauMobileTablePreferences(null).visible, ["numero", "sexe", "age"]);
});

test("les colonnes personnalisées gardent leur ordre et ignorent les valeurs inconnues", () => {
  const result = parseTroupeauMobileTablePreferences(JSON.stringify({ visible: ["group", "numero", "inconnue"], order: ["group", "numero"] }));
  assert.deepEqual(result.visible, ["group", "numero"]);
  assert.deepEqual(result.order.slice(0, 2), ["group", "numero"]);
});

test("une sélection persistée est conservée et dédupliquée", () => {
  assert.deepEqual(parsePersistentAnimalSelection('["a","b","a"]'), ["a", "b"]);
  assert.deepEqual(parsePersistentAnimalSelection("incorrect"), []);
});

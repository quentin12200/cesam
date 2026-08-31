import assert from "node:assert/strict";
import test from "node:test";
import { nutravsSelectionnes } from "./vaccination-session.ts";

test("une sélection partielle transmet exactement les sept animaux cochés", () => {
  const lignes = Array.from({ length: 19 }, (_, index) => ({ animalId: `animal-${index + 1}`, nutrav: String(7500 + index) }));
  const selection = new Set(lignes.slice(0, 7).map((ligne) => ligne.animalId));
  assert.deepEqual(nutravsSelectionnes(lignes, selection), lignes.slice(0, 7).map((ligne) => ligne.nutrav));
});

test("aucune sélection ne transmet aucun animal", () => {
  assert.deepEqual(nutravsSelectionnes([{ animalId: "animal-1", nutrav: "7505" }], new Set()), []);
});

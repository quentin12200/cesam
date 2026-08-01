import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_FAVORITES, PROTOTYPE_CATEGORIES, filterPrototypeAnimals, moveFavorite } from "./prototype-data.ts";

test("les cinq favoris demandés sont présents dans l'ordre initial", () => {
  assert.deepEqual(DEFAULT_FAVORITES.map((item) => item.label), [
    "Chaleur", "Saillie / IA", "Événement", "Parage", "Pesée rapide",
  ]);
});

test("la personnalisation réorganise une copie sans modifier la liste source", () => {
  const source = DEFAULT_FAVORITES.map((item) => item.id);
  const result = moveFavorite(source, 1, -1);
  assert.deepEqual(result.slice(0, 2), ["saillie", "chaleur"]);
  assert.deepEqual(source.slice(0, 2), ["chaleur", "saillie"]);
});

test("la recherche fictive accepte un numéro ou un nom", () => {
  assert.equal(filterPrototypeAnimals("9260")[0]?.name, "Java");
  assert.equal(filterPrototypeAnimals("lilas")[0]?.number, "6393");
  assert.deepEqual(filterPrototypeAnimals("inconnu"), []);
});

test("les catégories ne contiennent que les actions réelles prévues", () => {
  assert.deepEqual(PROTOTYPE_CATEGORIES.map((item) => item.label), [
    "Reproduction", "Santé et soins", "Troupeau", "Pesée",
  ]);
  assert.deepEqual(PROTOTYPE_CATEGORIES.find((item) => item.id === "pesee")?.actions.map((item) => item.label), [
    "Pesée rapide", "Séances de pesée",
  ]);
});

test("le prototype reste isolé des API, du stockage et de la navigation métier", () => {
  const source = readFileSync(new URL("./PrototypeAccueilV3.tsx", import.meta.url), "utf8");
  for (const forbidden of ["fetch(", "localStorage", "sessionStorage", "router.", "href="]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} ne doit pas être utilisé`);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_FAVORITES, PROTOTYPE_CATEGORIES, PROTOTYPE_EXIT_REASONS, filterPrototypeAnimals, moveFavorite, reorderActions } from "./prototype-data.ts";

test("les cinq favoris demandés sont présents dans l'ordre initial", () => {
  assert.deepEqual(DEFAULT_FAVORITES.map((item) => item.label), [
    "Chaleur", "Saillie / IA", "Nouvel événement sanitaire", "Parage", "Pesée rapide",
  ]);
});

test("le glisser-déposer réordonne une rubrique sans muter sa source", () => {
  const source = PROTOTYPE_CATEGORIES[0].actions;
  const result = reorderActions(source, "velage", "chaleur");
  assert.equal(result[0].id, "velage");
  assert.equal(source[0].id, "chaleur");
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
  assert.deepEqual(PROTOTYPE_CATEGORIES.find((item) => item.id === "reproduction")?.actions.map((item) => item.label), [
    "Chaleur", "Saillie / IA", "Échographie", "Vêlage",
  ]);
  assert.deepEqual(PROTOTYPE_CATEGORIES.find((item) => item.id === "sante")?.actions.map((item) => item.label), [
    "Nouvel événement sanitaire", "Parage", "Pharmacie", "Scanner une ordonnance",
  ]);
  assert.deepEqual(PROTOTYPE_CATEGORIES.find((item) => item.id === "troupeau")?.actions.map((item) => item.label), [
    "Identification", "Sevrage", "Généalogie", "Ajouter un animal", "Sortir un animal",
  ]);
  assert.equal(PROTOTYPE_CATEGORIES.flatMap((item) => item.actions).some((item) => item.label === "Carnet sanitaire" || item.label === "Gestation" || item.label === "Taureaux"), false);
});

test("les cinq motifs fictifs de sortie correspondent au retour SINal", () => {
  assert.deepEqual(PROTOTYPE_EXIT_REASONS, [
    "B — Boucherie", "C — Autoconsommation", "E — Élevage ou vente", "H — Prêt ou pension", "M — Mort",
  ]);
});

test("le prototype reste isolé des API, du stockage et de la navigation métier", () => {
  const source = readFileSync(new URL("./PrototypeAccueilV3.tsx", import.meta.url), "utf8");
  for (const forbidden of ["fetch(", "localStorage", "sessionStorage", "router.", "href="]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} ne doit pas être utilisé`);
  }
  assert.match(source, /Soutien et ressources/);
  assert.match(source, /Modifier l’ordre/);
});

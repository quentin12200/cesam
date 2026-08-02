import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACTION_CATALOG, ALL_PROTOTYPE_ACTIONS, DEFAULT_FAVORITES, PROTOTYPE_CATEGORIES,
  PROTOTYPE_EXIT_REASONS, addFavorite, filterPrototypeAnimals, removeFavorite,
  reorderActions,
} from "./prototype-data.ts";

test("chaque action possède une identité visuelle stable et unique", () => {
  assert.equal(new Set(ALL_PROTOTYPE_ACTIONS.map((item) => item.id)).size, ALL_PROTOTYPE_ACTIONS.length);
  for (const action of ALL_PROTOTYPE_ACTIONS) {
    assert.ok(action.id);
    assert.ok(action.icon);
    assert.ok(action.tone);
    assert.ok(action.category);
    assert.ok(action.destination.startsWith("/"));
  }
  const reordered = reorderActions(DEFAULT_FAVORITES, "pesee-rapide", "chaleur");
  assert.equal(reordered[0], ACTION_CATALOG.peseeRapide);
  assert.equal(reordered[0].tone, "green");
  assert.equal(reordered[0].icon, "scale");
});

test("les cinq favoris demandés sont présents dans l’ordre initial", () => {
  assert.deepEqual(DEFAULT_FAVORITES.map((item) => item.label), [
    "Chaleur", "Saillie / IA", "Nouvel événement sanitaire", "Parage", "Pesée rapide",
  ]);
});

test("le tri réordonne favoris et catégories sans muter leur source", () => {
  const favorites = reorderActions(DEFAULT_FAVORITES, "pesee-rapide", "chaleur");
  assert.equal(favorites[0].id, "pesee-rapide");
  assert.equal(DEFAULT_FAVORITES[0].id, "chaleur");

  const source = PROTOTYPE_CATEGORIES[0].actions;
  const category = reorderActions(source, "velage", "chaleur");
  assert.equal(category[0].id, "velage");
  assert.equal(source[0].id, "chaleur");
});

test("un favori peut être ajouté, retiré et ne peut pas être dupliqué", () => {
  const four = removeFavorite(DEFAULT_FAVORITES, "parage");
  assert.equal(four.length, 4);
  assert.equal(four.some((item) => item.id === "parage"), false);

  const restored = addFavorite(four, ACTION_CATALOG.parage);
  assert.equal(restored.length, 5);
  assert.equal(restored.at(-1), ACTION_CATALOG.parage);
  assert.equal(addFavorite(restored, ACTION_CATALOG.parage), restored);
});

test("la sélection respecte un minimum de 1 et un maximum de 5 favoris", () => {
  assert.equal(addFavorite(DEFAULT_FAVORITES, ACTION_CATALOG.velage), DEFAULT_FAVORITES);
  const single = [ACTION_CATALOG.chaleur];
  assert.equal(removeFavorite(single, "chaleur"), single);
});

test("Pesée rapide est retirable des favoris mais reste dans la catégorie Pesée", () => {
  const favorites = removeFavorite(DEFAULT_FAVORITES, "pesee-rapide");
  assert.equal(favorites.some((item) => item.id === "pesee-rapide"), false);
  assert.equal(
    PROTOTYPE_CATEGORIES.find((item) => item.id === "pesee")?.actions.includes(ACTION_CATALOG.peseeRapide),
    true,
  );
});

test("la recherche fictive accepte un numéro ou un nom", () => {
  assert.equal(filterPrototypeAnimals("9260")[0]?.name, "Java");
  assert.equal(filterPrototypeAnimals("lilas")[0]?.number, "6393");
  assert.deepEqual(filterPrototypeAnimals("inconnu"), []);
});

test("les catégories ne contiennent que les actions métier prévues", () => {
  assert.deepEqual(PROTOTYPE_CATEGORIES.map((item) => item.label), [
    "Reproduction", "Santé et soins", "Troupeau", "Pesée",
  ]);
  assert.deepEqual(PROTOTYPE_CATEGORIES.find((item) => item.id === "pesee")?.actions.map((item) => item.label), [
    "Pesée rapide", "Séances de pesée",
  ]);
  assert.equal(PROTOTYPE_CATEGORIES.flatMap((item) => item.actions).some((item) =>
    item.label === "Carnet sanitaire" || item.label === "Gestation" || item.label === "Taureaux"), false);
});

test("les cinq motifs fictifs de sortie correspondent au retour SINal", () => {
  assert.deepEqual(PROTOTYPE_EXIT_REASONS, [
    "B — Boucherie", "C — Autoconsommation", "E — Élevage ou vente", "H — Prêt ou pension", "M — Mort",
  ]);
});

test("le prototype expose le sélecteur et le tri visuel partagé sans sortir de son périmètre", () => {
  const source = readFileSync(new URL("./PrototypeAccueilV3.tsx", import.meta.url), "utf8");
  for (const forbidden of ["fetch(", "localStorage", "sessionStorage", "router.", "href="]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} ne doit pas être utilisé`);
  }
  assert.match(source, /Modifier les actions rapides/);
  assert.match(source, /Actions sélectionnées/);
  assert.match(source, /Actions disponibles/);
  assert.match(source, /layout="list"/);
  assert.match(source, /data-reorder-layout/);
  assert.match(source, /Retirez une action pour en ajouter une autre/);
  assert.match(source, /pointer-events-none fixed/);
  assert.match(source, /outline-dashed/);
  assert.match(source, /function ReorderableGrid/);
});

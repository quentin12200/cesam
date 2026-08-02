import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACTION_CATALOG, ALL_PROTOTYPE_ACTIONS, DEFAULT_FAVORITES, MAX_FAVORITES, PROTOTYPE_CATEGORIES,
  PROTOTYPE_EXIT_REASONS, addFavorite, filterPrototypeAnimals, removeFavorite,
  getSortableAutoScrollDelta, reorderActions,
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
  const reordered = reorderActions(DEFAULT_FAVORITES, "nouvel-evenement", "chaleur");
  assert.equal(reordered[0], ACTION_CATALOG.nouvelEvenement);
  assert.equal(reordered[0].tone, "blue");
  assert.equal(reordered[0].icon, "stethoscope");
});

test("les trois favoris mobiles sont présents dans l’ordre initial", () => {
  assert.deepEqual(DEFAULT_FAVORITES.map((item) => item.label), [
    "Chaleur", "Saillie / IA", "Nouvel événement sanitaire",
  ]);
});

test("le tri réordonne favoris et catégories sans muter leur source", () => {
  const favorites = reorderActions(DEFAULT_FAVORITES, "nouvel-evenement", "chaleur");
  assert.equal(favorites[0].id, "nouvel-evenement");
  assert.equal(DEFAULT_FAVORITES[0].id, "chaleur");

  const source = PROTOTYPE_CATEGORIES[0].actions;
  const category = reorderActions(source, "velage", "chaleur");
  assert.equal(category[0].id, "velage");
  assert.equal(source[0].id, "chaleur");
});

test("un seul déplacement traverse directement plusieurs positions", () => {
  const lastToFirst = reorderActions(DEFAULT_FAVORITES, "nouvel-evenement", "chaleur");
  assert.deepEqual(lastToFirst.map((item) => item.id), [
    "nouvel-evenement", "chaleur", "saillie",
  ]);

  const firstToLast = reorderActions(DEFAULT_FAVORITES, "chaleur", "nouvel-evenement");
  assert.deepEqual(firstToLast.map((item) => item.id), [
    "saillie", "nouvel-evenement", "chaleur",
  ]);
});

test("le tri lointain conserve toutes les identités sans doublon", () => {
  const result = reorderActions(DEFAULT_FAVORITES, "nouvel-evenement", "chaleur");
  assert.equal(new Set(result.map((item) => item.id)).size, DEFAULT_FAVORITES.length);
  assert.deepEqual(new Set(result), new Set(DEFAULT_FAVORITES));
  assert.equal(result[0].label, ACTION_CATALOG.nouvelEvenement.label);
  assert.equal(result[0].icon, ACTION_CATALOG.nouvelEvenement.icon);
  assert.equal(result[0].tone, ACTION_CATALOG.nouvelEvenement.tone);
});

test("la même logique permet un déplacement lointain dans une rubrique", () => {
  const source = PROTOTYPE_CATEGORIES.find((item) => item.id === "troupeau")?.actions ?? [];
  const result = reorderActions(source, "sortir-animal", "identification");
  assert.deepEqual(result.map((item) => item.id), [
    "sortir-animal", "identification", "sevrage", "genealogie", "ajouter-animal",
  ]);
});

test("l’auto-scroll s’active uniquement près des bords", () => {
  assert.ok(getSortableAutoScrollDelta(110, 100, 500) < 0);
  assert.equal(getSortableAutoScrollDelta(300, 100, 500), 0);
  assert.ok(getSortableAutoScrollDelta(490, 100, 500) > 0);
});

test("un favori peut être ajouté, retiré et ne peut pas être dupliqué", () => {
  const two = removeFavorite(DEFAULT_FAVORITES, "nouvel-evenement");
  assert.equal(two.length, 2);
  assert.equal(two.some((item) => item.id === "nouvel-evenement"), false);

  const restored = addFavorite(two, ACTION_CATALOG.nouvelEvenement);
  assert.equal(restored.length, MAX_FAVORITES);
  assert.equal(restored.at(-1), ACTION_CATALOG.nouvelEvenement);
  assert.equal(addFavorite(restored, ACTION_CATALOG.nouvelEvenement), restored);
});

test("la sélection respecte un minimum de 1 et un maximum de 3 favoris", () => {
  assert.equal(MAX_FAVORITES, 3);
  assert.equal(addFavorite(DEFAULT_FAVORITES, ACTION_CATALOG.velage), DEFAULT_FAVORITES);
  const single = [ACTION_CATALOG.chaleur];
  assert.equal(removeFavorite(single, "chaleur"), single);
});

test("Pesée rapide est retirable des favoris mais reste dans la catégorie Pesée", () => {
  const favorites = addFavorite(removeFavorite(DEFAULT_FAVORITES, "nouvel-evenement"), ACTION_CATALOG.peseeRapide);
  const withoutWeighing = removeFavorite(favorites, "pesee-rapide");
  assert.equal(withoutWeighing.some((item) => item.id === "pesee-rapide"), false);
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
  assert.match(source, /document\.addEventListener\("pointermove"/);
  assert.match(source, /requestAnimationFrame/);
  assert.equal(source.includes("onLostPointerCapture={stopDrag}"), false);
});

test("la version compacte conserve les accès essentiels et l’ordre des sections", () => {
  const source = readFileSync(new URL("./PrototypeAccueilV3.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("Bonjour Céline"), false);
  assert.equal(source.includes("Vendredi 1 août"), false);
  assert.match(source, /Rechercher rapidement un animal/);
  assert.match(source, /Dicter une action ou un événement/);
  assert.match(source, /Enregistrer une note vocale libre/);
  assert.match(source, /label: "Paramètres"/);
  assert.match(source, /label: "Soutien et ressources"/);
  assert.match(source, /label: "Se déconnecter"/);
  assert.equal(source.includes('aria-label="Paramètres"><Settings'), false);
  assert.equal(source.includes("overflow-x-auto"), false);
  assert.equal(source.includes("Voir plus"), false);
  assert.ok(source.indexOf("<NewsSection") < source.indexOf('aria-labelledby="daily-title"'));
  assert.ok(source.indexOf('aria-labelledby="daily-title"') < source.indexOf('aria-labelledby="other-title"'));
  assert.ok(source.indexOf('aria-labelledby="other-title"') < source.indexOf("Aperçu de l’élevage"));
  assert.ok(source.indexOf("Aperçu de l’élevage") < source.lastIndexOf("Soutien et ressources"));
  for (const news of ["Pesée en cours", "Veaux jamais pesés", "Retour en chaleur détecté", "Sevrage à prévoir"]) {
    assert.match(source, new RegExp(news));
  }
});

test("l’accueil officiel reste hors du périmètre du prototype", () => {
  const officialHome = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");
  assert.equal(officialHome.includes("PrototypeAccueilV3"), false);
});

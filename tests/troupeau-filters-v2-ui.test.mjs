import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/troupeau/page.tsx", "utf8");
const filters = readFileSync("app/troupeau/TroupeauFilters.tsx", "utf8");
const table = readFileSync("app/troupeau/TroupeauTableau.tsx", "utf8");
const print = readFileSync("app/troupeau/impression/page.tsx", "utf8");

test("desktop et mobile partagent le même composant et les mêmes paramètres", () => {
  assert.match(page, /<TroupeauFilters/);
  assert.match(page, /params=\{\{ sexe, q, categorie, tarie, repro, sanitaire, sevrage, groupe, tri \}\}/);
  assert.match(filters, /hidden items-center[\s\S]*lg:flex/);
  assert.match(filters, /lg:hidden/);
  assert.match(filters, /Voir les \{total\}/);
});

test("la recherche et les filtres actifs restent visibles et pilotés par l'URL", () => {
  assert.match(filters, /N° travail, nom ou N° national…/);
  assert.match(filters, /updateTroupeauSearchParams/);
  assert.match(filters, /Filtres\{active\.length \? ` · \$\{active\.length\}`/);
  assert.match(filters, /Réinitialiser/);
});

test("les menus de filtres ont disparu des titres du tableau", () => {
  assert.doesNotMatch(table, /FilterDropdown|CATS_OPTIONS|REPRO_OPTIONS/);
  assert.match(table, />Catégorie<\/th>/);
  assert.match(table, />Repro<\/th>/);
});

test("l'impression réutilise le moteur strict et le filtre sevrage", () => {
  assert.match(print, /buildTroupeauWhere\(filters\)/);
  assert.match(print, /filtrerAnimauxParCriteresLocaux\(animauxNonFiltres, filters, now\)/);
  assert.match(print, /sevrage\?: string/);
  assert.doesNotMatch(print, /switch \(categorie/);
});

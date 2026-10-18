import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { lireCategoriesHistoriques } from "./vaccine-category-selection.ts";

test("catégories historiques : cible vide vaut tous les bovins, sans migration forcée", () => {
  assert.deepEqual(lireCategoriesHistoriques(null), []);
  assert.deepEqual(lireCategoriesHistoriques("[]"), []);
  assert.deepEqual(lireCategoriesHistoriques('["GENISSE","VACHE"]'), ["GENISSE","VACHE"]);
  assert.deepEqual(lireCategoriesHistoriques('["VELLE","GENISSE","VACHE"]'), ["VELLE","GENISSE","VACHE"]);
});

test("une configuration de catégorie illisible est bloquée, jamais ramenée à Tous les bovins", () => {
  assert.equal(lireCategoriesHistoriques("[oops"), null);
  assert.equal(lireCategoriesHistoriques('{"x":"VELLE"}'), null);
  assert.equal(lireCategoriesHistoriques('["CATEGORIE_INCONNUE"]'), null);
  assert.equal(lireCategoriesHistoriques('["VELLE","VELLE"]'), null);
});

test("l'API de ciblage historique n'écrit que les catégories du protocole et journalise l'avant", () => {
  const route = readFileSync(new URL("../app/api/protocoles/[id]/categories/route.ts", import.meta.url),"utf8");
  assert.match(route, /configurationQuestionnaireJson: null/);
  assert.match(route, /tx\.protocoleVaccin\.updateMany/);
  assert.match(route, /data: \{ categoriesJson: cibleNouvelle \}/);
  assert.match(route, /expectedCategoriesJson/);
  assert.match(route, /tx\.actionLog\.create/);
  assert.match(route, /categoriesJson: actuel\.categoriesJson/);
  assert.doesNotMatch(route, /tx\.(?:vaccination|traitement|etapeProtocoleVaccin|statutProtocoleVaccinal)\.(?:update|delete|create)/);
});

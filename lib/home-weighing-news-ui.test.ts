import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ACCUEIL_SHORTCUT_IDS } from "./accueil-shortcuts.ts";

const shortcuts = readFileSync(new URL("../app/components/AccueilShortcuts.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const news = readFileSync(new URL("../app/components/HomeActiveWeighingNews.tsx", import.meta.url), "utf8");
const target = readFileSync(new URL("../app/troupeau/pesee/jamais-peses/page.tsx", import.meta.url), "utf8");

test("conserve toutes les actions configurables et ajoute Pesée rapide en permanence", () => {
  for (const id of ACCUEIL_SHORTCUT_IDS) assert.match(shortcuts, new RegExp(`${JSON.stringify(id)}|${id}`));
  assert.match(shortcuts, /Pesée rapide/);
  assert.match(shortcuts, /href="\/troupeau\/pesee"/);
});

test("le grand bloc autonome de pesée n’est plus rendu sur l’accueil", () => {
  assert.doesNotMatch(home, /HomeWeighingPanel/);
  assert.doesNotMatch(home, /data-layout-section="accueil-pesee"/);
});

test("la séance active et les attentes restent compactes dans Actualités", () => {
  assert.match(home, /HomeActiveWeighingNews/);
  assert.match(news, /en attente de synchronisation/);
  assert.match(news, /href="\/troupeau\/pesee"/);
  assert.match(news, /min-h-14/);
});

test("l’actualité jamais pesés ouvre la liste ciblée et la pesée", () => {
  assert.match(home, /href="\/troupeau\/pesee\/jamais-peses"/);
  assert.match(home, /Démarrer une pesée/);
  assert.match(target, /neverWeighedAnimalWhere/);
  assert.match(target, /md:grid-cols-2/);
});

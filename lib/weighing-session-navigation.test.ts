import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../app/components/HomeWeighingPanel.tsx", import.meta.url), "utf8");
const history = readFileSync(new URL("../app/troupeau/pesee/sessions/page.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/troupeau/pesee/sessions/[id]/SessionDetailClient.tsx", import.meta.url), "utf8");

test("l’accueil attend le chargement avant de choisir Démarrer ou Reprendre", () => {
  assert.match(home, /if \(!view\)/);
  assert.match(home, /active \? "Reprendre la séance" : "Démarrer une pesée"/);
});

test("l’accueil navigue vers la pesée et l’historique", () => {
  assert.match(home, /href="\/troupeau\/pesee"/);
  assert.match(home, /href="\/troupeau\/pesee\/sessions"/);
});

test("l’historique utilise des cartes mobiles et une grille ordinateur", () => {
  assert.match(history, /space-y-3/);
  assert.match(history, /md:grid-cols-/);
  assert.match(history, /min-h-11/);
});

test("la lecture d’une ancienne séance ne touche jamais au cache actif", () => {
  assert.doesNotMatch(detail, /localStorage/);
  assert.match(detail, /Ouvrir la simulation enregistrée/);
  assert.match(detail, /Reprendre la séance/);
  assert.doesNotMatch(detail, /Modifier|Annuler/);
});

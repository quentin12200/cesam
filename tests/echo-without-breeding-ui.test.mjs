import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [modal, route] = await Promise.all([
  readFile(new URL("../app/troupeau/[nutrav]/EchoModal.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/echographies/route.ts", import.meta.url), "utf8"),
]);

test("le formulaire autorise VIDE sans tentative mais exige une origine pour PLEINE", () => {
  assert.match(modal, /resultat === "PLEINE" && !originSaillieId/);
  assert.match(modal, /animalId,/);
  assert.match(modal, /saillieId: originSaillieId \|\| null/);
  assert.doesNotMatch(modal, /Aucune saillie ou IA n’est disponible pour enregistrer cette échographie/);
});

test("l'API distingue l'échographie VIDE autonome de la gestation PLEINE", () => {
  assert.match(route, /resultat === "VIDE" && !saillieId/);
  assert.match(route, /recordStandaloneNegativeEcho\(animalId, date, remarque\)/);
  assert.match(route, /Une saillie ou une IA est requise pour une échographie pleine/);
});

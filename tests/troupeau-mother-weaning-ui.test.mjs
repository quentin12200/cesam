import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tableau = await readFile(new URL("../app/troupeau/TroupeauTableau.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/troupeau/page.tsx", import.meta.url), "utf8");

test("affiche les colonnes Mère, Père et l’alerte de sevrage sur ordinateur", () => {
  assert.match(tableau, />Mère</);
  assert.match(tableau, />Père</);
  assert.match(tableau, />Sevrage</);
  assert.match(tableau, /🍼 \{motherWeaning\.statusLabel\}/);
  assert.doesNotMatch(tableau, />Autorisée</);
  assert.doesNotMatch(tableau, />⛔ Interdite</);
});

test("charge uniquement les données généalogiques et de sevrage nécessaires", () => {
  assert.match(page, /mere: \{ select: \{ id: true, nutrav: true, nobovi: true \} \}/);
  assert.match(page, /numeip: true/);
  assert.match(page, /nomeip: true/);
  assert.match(page, /sevreFait: true/);
  assert.match(page, /taureau: \{ select: \{ nopere: true, nupere: true \} \}/);
  assert.doesNotMatch(page, /dateSevrage: true/);
});

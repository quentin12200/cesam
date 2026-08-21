import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tableau = await readFile(new URL("../app/troupeau/TroupeauTableau.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/troupeau/page.tsx", import.meta.url), "utf8");

test("remplace la colonne Vente par Mère / sevrage", () => {
  assert.match(tableau, /Mère \/ sevrage/);
  assert.doesNotMatch(tableau, />Autorisée</);
  assert.doesNotMatch(tableau, />⛔ Interdite</);
});

test("charge uniquement la mère et le statut de sevrage nécessaires", () => {
  assert.match(page, /mere: \{ select: \{ nutrav: true \} \}/);
  assert.match(page, /sevreFait: true/);
  assert.match(page, /dateSevrage: true/);
});

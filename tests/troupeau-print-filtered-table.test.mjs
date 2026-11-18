import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/troupeau/page.tsx", import.meta.url), "utf8");
const table = readFileSync(new URL("../app/troupeau/TroupeauTableau.tsx", import.meta.url), "utf8");

test("le menu impression réutilise le même tableau et ses paramètres de filtre et de tri", () => {
  assert.match(page, /printHref=\{\`\/troupeau\?/);
  assert.match(page, /sexe, q, categorie, tarie, repro, sanitaire, sevrage, groupe, tri, tri2, print: "1"/);
  assert.match(page, /<TroupeauTableau/);
  assert.match(page, /<TroupeauAutoPrint/);
});

test("l'impression A4 portrait conserve les colonnes utiles et masque les colonnes non imprimables", () => {
  assert.match(table, /nom: true, age: true, poids: true, categorie: true/);
  assert.match(table, /A4 portrait/);
  assert.match(table, /th:nth-child\(6\), \.troupeau-print-view td:nth-child\(6\) \{ display: none/);
  assert.match(table, /print-heading hidden/);
  assert.match(table, /print:hidden">Parenté/);
  assert.match(table, /print:hidden">Actions/);
  assert.match(table, /animaux\.map\(/);
});

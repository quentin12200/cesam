import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const table = readFileSync(new URL("../app/troupeau/TroupeauTableau.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/troupeau/page.tsx", import.meta.url), "utf8");

test("l'impression reste dans le flux paginé et répète les en-têtes", () => {
  assert.match(table, /\.troupeau-print-view \{ position: static !important/);
  assert.match(table, /thead \{ display: table-header-group !important/);
  assert.match(table, /tbody \{ display: table-row-group !important/);
  assert.match(table, /padding: 3px 2px !important/);
  assert.match(table, /break-inside: avoid-page/);
});

test("le tableau trié et filtré est conservé et la parenté masquée", () => {
  assert.match(page, /sexe, q, categorie, tarie, repro, sanitaire, sevrage, groupe, tri, tri2, print: "1"/);
  assert.match(table, /\[class~="print:hidden"\]/);
  assert.match(table, /print:hidden">Parenté/);
  assert.match(table, /print:hidden">Actions/);
  assert.match(table, /animaux\.map\(/);
});

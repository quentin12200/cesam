import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [weaningPage, printPage, printLogic] = await Promise.all([
  readFile(new URL("../app/troupeau/sevrage/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/sevrage/impression/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/weaning-print.ts", import.meta.url), "utf8"),
]);

test("la zone sevrage propose la feuille imprimable sans modifier son workflow", () => {
  assert.match(weaningPage, /href="\/troupeau\/sevrage\/impression"/);
  assert.match(weaningPage, /🖨️ Imprimer la liste/);
  assert.match(weaningPage, /<WeaningDryOffPanel/);
});

test("la feuille est une A4 paysage lisible et paginée par lignes", () => {
  assert.match(printPage, /VEAUX À SEVRER/);
  assert.match(printPage, /1 — À SEVRER/);
  assert.match(printPage, /2 — À PRÉVOIR/);
  assert.match(printPage, /@page \{ size: A4 landscape/);
  assert.match(printPage, /display: table-header-group/);
  assert.match(printPage, /page-break-inside: avoid/);
  assert.match(printPage, /\.screen-actions \{ display: none !important/);
  assert.match(printLogic, /☐ Échographier mère/);
  assert.match(printPage, /Aucun veau à sevrer actuellement/);
});

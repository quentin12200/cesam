import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const table = readFileSync(new URL("../app/troupeau/TroupeauTableau.tsx", import.meta.url), "utf8");

test("print keeps calf numbers unbroken and reserves column width", () => {
  assert.match(table, /th:nth-child\(10\), \.troupeau-print-view td:nth-child\(10\) \{ width: 20% !important/);
  assert.match(table, /\.calf-number \{ display: inline-block !important; white-space: nowrap !important; overflow-wrap: normal !important; word-break: keep-all !important/);
  assert.match(table, /\.calf-detail \{ white-space: nowrap !important/);
  assert.match(table, /className={`calf-number whitespace-nowrap/);
  assert.match(table, /className="calf-detail whitespace-nowrap/);
});

test("print retains A4 portrait pagination and repeated table headers", () => {
  assert.match(table, /@page \{ size: A4 portrait; margin: 8mm 6mm/);
  assert.match(table, /thead \{ display: table-header-group !important/);
  assert.match(table, /tr \{ display: table-row !important; break-inside: avoid-page/);
  assert.match(table, /\.calf-item \{ display: flex !important; flex-wrap: wrap !important/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/troupeau/page.tsx", "utf8");
const table = readFileSync("app/troupeau/TroupeauTableau.tsx", "utf8");

test("secondary sort only breaks ties within primary calving-date order", () => {
  assert.match(page, /if \(!tri2 \|\| !filters\.tri\?\.startsWith\("repro_"\)\)/);
  assert.match(page, /return \(ad - bd\) \* reverse \|\| secondaryCompare\(a, b\)/);
  assert.match(page, /return groupDifference \|\| secondaryCompare\(a, b\)/);
  assert.match(page, /const groupDifference = reproductionGroup\(a\) - reproductionGroup\(b\)/);
  assert.match(page, /if \(state === "REPOS"\) return 1/);
  assert.match(page, /if \(state === "ROUGE"\) return 2/);
  assert.match(page, /tri2\.startsWith\("age_"\)/);
  assert.match(page, /tri2\.startsWith\("sexe_"\)/);
  assert.match(page, /tri2\.startsWith\("categorie_"\)/);
});

test("secondary sort is three-state and marked directly in headers", () => {
  assert.match(table, /currentTri2 === asc \? desc : currentTri2 === desc \? undefined : asc/);
  assert.match(table, /disabled=\{!reproPrimary\}/);
  assert.match(table, /secondaryHeader\("age", "Âge"\)/);
  assert.match(table, /secondaryHeader\("sexe", "Sexe"\)/);
  assert.match(table, /secondaryHeader\("categorie", "Catégorie"\)/);
  assert.match(table, /"2 ↑" : "2 ↓"/);
  assert.match(table, /"1 ↑" : "1 ↓"/);
  assert.match(table, /params.delete\("tri2"\)/);
  assert.match(table, /if \(isDesc\)/);
});

test("print URL preserves secondary sort and sex column remains screen-only", () => {
  assert.match(page, /groupe, tri, tri2, print: "1"/);
  assert.match(table, /print:hidden">\{animal\.sexbov === "F"/);
});

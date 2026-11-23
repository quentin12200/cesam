import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/troupeau/gmq/page.tsx", import.meta.url), "utf8");
const herd = readFileSync(new URL("../app/troupeau/page.tsx", import.meta.url), "utf8");

test("GMQ loads only paternal genealogy sources", () => {
  for (const field of ["pereNomManuel", "pereNationalManuel", "pereTravailManuel", "taureau:", "pereNunati", "pereNom"]) {
    assert.ok(page.includes(field), `Missing paternal genealogy source: ${field}`);
  }
});

test("historical NUMEIP/NOMEIP are maternal fields, never sire fallbacks", () => {
  // The herd's established mother mapping is our regression reference.
  assert.match(herd, /mereNom:.*animal\.nomeip/);
  assert.match(herd, /mereNutrav:.*animal\.numeip/);
  const select = page.slice(page.indexOf("veau: { select:"), page.indexOf("pesees: { orderBy:"));
  const resolution = page.slice(page.indexOf("const fatherNational"), page.indexOf("return [{"));
  for (const maternal of ["numeip", "nomeip", "tramip"]) {
    assert.doesNotMatch(select, new RegExp(`\\b${maternal}: true`));
    assert.doesNotMatch(resolution, new RegExp(`calf\\.${maternal}\\b`));
  }
});

test("paternal identity prefers calf father, then linked bull, then birth record", () => {
  assert.match(page, /calf\.pereNationalManuel\?\.trim\(\)[\s\S]*?bull\?\.nupere\?\.trim\(\)[\s\S]*?v\.pereNunati\?\.trim\(\)/);
  assert.match(page, /calf\.pereNomManuel\?\.trim\(\)[\s\S]*?bull\?\.nopere\?\.trim\(\)[\s\S]*?v\.pereNom\?\.trim\(\)/);
  assert.match(page, /pereNational: fatherNational/);
  assert.match(page, /pere: fatherName/);
});

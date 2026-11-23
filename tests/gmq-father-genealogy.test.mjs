import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/troupeau/gmq/page.tsx", import.meta.url), "utf8");

test("GMQ loads calf genealogy fields, not just calving father", () => {
  for (const field of ["pereNomManuel", "pereNationalManuel", "pereTravailManuel", "numeip", "nomeip", "tramip", "taureau:"]) {
    assert.ok(page.includes(field), `Missing calf genealogy source: ${field}`);
  }
});

test("calf genealogy takes precedence over birth and breeding fallbacks", () => {
  assert.match(page, /calf\.pereNationalManuel\?\.trim\(\) \|\| calf\.numeip\?\.trim\(\)/);
  assert.match(page, /calf\.pereNomManuel\?\.trim\(\) \|\| calf\.nomeip\?\.trim\(\)/);
  assert.match(page, /pereNational: fatherNational/);
  assert.match(page, /pere: fatherName/);
});

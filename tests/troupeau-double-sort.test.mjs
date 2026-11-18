import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/troupeau/page.tsx", "utf8");
const table = readFileSync("app/troupeau/TroupeauTableau.tsx", "utf8");
const filters = readFileSync("lib/troupeau-filters.ts", "utf8");

test("one comparator applies primary then secondary only on ties", () => {
  assert.match(page, /compare\(a, b, primarySort\)/);
  assert.match(page, /secondarySort \? compare\(a, b, secondarySort\) : 0/);
  assert.match(page, /animaux\.sort\(\(a, b\) =>/);
  assert.equal((page.match(/animaux\.sort\(/g) ?? []).length, 1);
  assert.match(page, /secondarySort = params\.multi === "1" && params\.tri2/);
  assert.match(page, /params\.tri2\.split\("_"\)\[0\] !== primarySort\.split\("_"\)\[0\]/);
});

test("all eight header sorts are accepted as primary and secondary", () => {
  for (const field of ["numero", "nom", "age", "sexe", "categorie", "repro", "velage", "veau"]) {
    assert.match(page, new RegExp('field === "' + field + '"'));
    assert.match(table, new RegExp('triAsc="' + field + '_asc"'));
    assert.match(filters, /numero\|nom\|age\|sexe\|categorie\|repro\|velage\|veau/);
  }
  assert.match(page, /const tri2 = \/\^\(numero\|nom\|age\|sexe\|categorie\|repro\|velage\|veau\)/);
});

test("missing values stay last and calf numbers compare numerically", () => {
  assert.match(page, /if \(a == null \|\| b == null\)/);
  assert.match(page, /x\.localeCompare\(y, "fr", \{ numeric: true \}\)/);
  assert.match(page, /calfNumber\(a\), calfNumber\(b\)/);
});

test("independent header controls retain print view and reproduction colors", () => {
  assert.match(table, /title=\{\`Tri principal : \$\{label\}\`\}/);
  assert.match(table, /title=\{\`Ajouter \$\{label\} en tri secondaire/);
  assert.match(table, /!sameField/);
  assert.match(table, /secondary\?\.split\("_"\)\[0\] === value\.split\("_"\)\[0\]/);
  assert.match(page, /groupe, tri, tri2, print: "1"/);
  assert.match(table, /REPRO_COLORS\[etat\]/);
});

test("multi-sort is opt-in and disabling it clears the second criterion", () => {
  assert.match(table, /type="checkbox" checked=\{multiSort\}/);
  assert.match(table, /next\.delete\("multi"\); next\.delete\("tri2"\)/);
  assert.match(table, /multiSort && triAsc && !sameField/);
  assert.match(table, /if \(key === "tri" && \(!multiSort/);
  assert.match(page, /secondarySort = params\.multi === "1" && params\.tri2/);
});

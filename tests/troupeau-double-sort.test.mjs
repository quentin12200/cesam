import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/troupeau/page.tsx", "utf8");
const table = readFileSync("app/troupeau/TroupeauTableau.tsx", "utf8");

test("free two-level sorting compares primary first and secondary only on ties", () => {
  assert.match(page, /selectedSort && supported\.test\(selectedSort\) \? compare\(a, b, selectedSort\) : 0/);
  assert.match(page, /selectedSecond && supported\.test\(selectedSecond\) \? compare\(a, b, selectedSecond\) : 0/);
  assert.match(page, /numero\|nom\|age\|sexe\|categorie\|velage\|repro/);
  assert.match(page, /if \(av == null \|\| bv == null\)/);
});

test("each sortable header supports primary and secondary priority", () => {
  assert.match(table, /title=\{\`Tri principal : \$\{label\}\`\}/);
  assert.match(table, /title=\{\`Ajouter \$\{label\} en tri secondaire/);
  for (const field of ["age", "sexe", "categorie", "repro", "velage"]) {
    assert.match(table, new RegExp('triAsc="' + field + '_asc"'));
  }
  assert.match(table, /next\.set\("vue", "tableau"\)/);
  assert.match(table, /secondary === triAsc \? triDesc : undefined/);
});

test("compact table preserves printing and visibly colored reproduction states", () => {
  assert.match(page, /groupe, tri, tri2, print: "1"/);
  assert.match(table, /table-fixed text-\[11px\]/);
  assert.doesNotMatch(table, /min-w-\[1080px\]/);
  assert.match(table, /REPRO_COLORS\[etat\]/);
  for (const state of ["VERT", "ROSE", "JAUNE", "GRIS", "ROUGE", "REPOS"]) {
    assert.match(table, new RegExp(state + ': "border border-'));
  }
  assert.match(table, /print:hidden">\{animal\.sexbov === "F"/);
});

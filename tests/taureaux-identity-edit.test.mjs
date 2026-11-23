import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync(new URL("../app/api/taureaux/route.ts", import.meta.url),"utf8");
const table = readFileSync(new URL("../app/taureaux/controle/FatherControlTable.tsx", import.meta.url),"utf8");
test("national correction keeps transactional updates to exact genealogy references", () => {
  assert.match(route,/prisma\.\$transaction\(async \(tx\)/);
  assert.match(route,/pereNationalManuel: oldNumber/);
  assert.match(route,/pereNunati: oldNumber/);
  assert.match(route,/normalizeGenealogyNational\(other\.nupere\)/);
});
test("editing work number does not require a schema change", () => {
  assert.match(route,/work\.length > 40/);
  assert.match(route,/traper: work \|\| null/);
  assert.match(table,/Modifier identité/);
  assert.match(table,/traper: editWork/);
});

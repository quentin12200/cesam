import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const form = readFileSync("app/velage/VelageFormWrapper.tsx", "utf8");
const create = readFileSync("app/api/velages/route.ts", "utf8");
const edit = readFileSync("lib/velage-edit.ts", "utf8");
const bulls = readFileSync("app/api/taureaux/route.ts", "utf8");

test("creation and edition use selected bull identity rather than free text alone", () => {
  assert.match(form, /pereTaureauId: pereTaureauId \|\| undefined/);
  assert.match(create, /taureauId: pereRetenu.id/);
  assert.match(edit, /taureauId: pereSelectionne.id/);
});
test("confirmed breeding cannot be overwritten by a different selected bull", () => {
  assert.match(create, /gestationPrecontrole\.saillie\.taureauId !== pereSelectionne.id/);
  assert.match(edit, /gestationLiee\.saillie\.taureauId !== pereSelectionne.id/);
});
test("new bulls can be recorded pending a national identifier, and duplicate names are checked", () => {
  assert.match(bulls, /numeroACompleter/);
  assert.match(bulls, /sameNames.length > 0/);
});

const audit = readFileSync("app/taureaux/controle/anciens-velages/page.tsx", "utf8");
test("father conflict checks happen before the first calf write", () => {
  assert.ok(create.indexOf("const gestationPrecontrole") < create.indexOf("const resolus:"));
  assert.match(create, /existing\.taureauId !== perePrecontrole\.id/);
  assert.match(edit, /existing\.taureauId !== pereSelectionne\.id/);
});
test("legacy father audit is read-only and requires explicit user validation", () => {
  assert.match(audit, /validation humaine obligatoire/);
  assert.match(audit, /Plusieurs candidats/);
  assert.doesNotMatch(audit, /prisma\.(animal|velage)\.(update|create|delete)/);
  assert.match(audit, /\/velage\?modifier=/);
});
test("father picker supports mobile touch targets and accented name search", () => {
  assert.match(form, /normalize\("NFD"\)/);
  assert.match(form, /max-h-40 overflow-auto/);
});

test("the father selection is cleared before reusing the calving form", () => {
  assert.match(form, /function reset\(\).*reinitialiserPere\(\)/);
  assert.match(form, /function reinitialiserPere\(\) \{[\s\S]*?setPereTaureauId\(""\)/);
  assert.match(form, /if \(nom && !pereSaisi\.current\)/);
});

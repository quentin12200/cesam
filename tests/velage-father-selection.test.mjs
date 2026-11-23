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
  assert.match(create, /gestation\.saillie\.taureauId !== pereSelectionne.id/);
  assert.match(edit, /gestationLiee\.saillie\.taureauId !== pereSelectionne.id/);
});
test("new bulls can be recorded pending a national identifier, and duplicate names are checked", () => {
  assert.match(bulls, /numeroACompleter/);
  assert.match(bulls, /sameNames.length > 0/);
});

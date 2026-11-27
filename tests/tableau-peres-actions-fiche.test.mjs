import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const table = readFileSync("app/taureaux/controle/FatherControlTable.tsx", "utf8");
const editor = readFileSync("app/taureaux/[id]/BullIdentityEditor.tsx", "utf8");
const identity = readFileSync("lib/bull-identity.ts", "utf8");

test("Le tableau ne propose que la fiche et la suppression dans le menu", () => {
  assert.match(table, /<RecordActionsMenu actions=\{\[/);
  assert.match(table, /label: "Voir la fiche"/);
  assert.match(table, /label: "Supprimer"/);
  assert.match(table, /confirmMessage:/);
  assert.doesNotMatch(table, /Corriger le nom|label: "Fusionner"/);
});
test("La fiche conserve la correction du nom et du numéro national", () => {
  assert.match(editor, /Corriger le nom \/ numéro/);
  assert.match(editor, /nopere/);
  assert.match(editor, /nupere/);
});
test("Le numéro de travail conserve les zéros initiaux", () => {
  assert.match(identity, /slice\(-4\)/);
});

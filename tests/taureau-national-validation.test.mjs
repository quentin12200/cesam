import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync("app/api/taureaux/route.ts", "utf8");
const editor = readFileSync("app/taureaux/[id]/BullIdentityEditor.tsx", "utf8");
const identity = readFileSync("lib/bull-identity.ts", "utf8");

test("PATCH valide les chiffres réels et pas une barre oblique littérale", () => {
  const validation = route.match(/!\/(\^\(\?:\[A-Z\]\{2\}\)\?.+?)\/\.test\(number\)/);
  assert.ok(validation, "Validation PATCH introuvable");
  const regex = new RegExp(validation[1]);
  assert.equal(regex.test("FR6415133847"), true);
  assert.equal(regex.test("6415133847"), true);
  assert.equal(regex.test("FR1234567"), false);
  assert.equal(regex.test("FR1234567890123456"), false);
  assert.equal(regex.test("UMETXO"), false);
});
test("Le formulaire envoie nom et numéro au PATCH", () => {
  assert.match(editor, /method: "PATCH"/);
  assert.match(editor, /nopere: nom, nupere: numero/);
  assert.match(editor, /replace\(\/\\s\+\/g, ""\)/);
});
test("Le code pays explicite est préservé et les quatre derniers chiffres servent au numéro de travail", () => {
  assert.match(identity, /if \(\/\^\[A-Z\]\{2\}\[A-Z0-9\]\+\$\/\.test\(raw\)\) return raw/);
  assert.match(editor, /\\d\{4\}\$/);
  assert.equal("FR6415133847".slice(-4), "3847");
});

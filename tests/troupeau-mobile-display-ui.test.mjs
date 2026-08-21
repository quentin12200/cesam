import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mobile = await readFile(new URL("../app/troupeau/TroupeauMobileList.tsx", import.meta.url), "utf8");
const desktop = await readFile(new URL("../app/troupeau/TroupeauTableau.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/troupeau/page.tsx", import.meta.url), "utf8");

test("propose et mémorise les options d’affichage uniquement sur téléphone", () => {
  assert.match(mobile, /cesam:troupeau-mobile-display:v1/);
  assert.match(mobile, /Affichage gestation/);
  assert.match(mobile, /Réinitialiser l’affichage/);
  assert.match(mobile, /localStorage\.setItem/);
  assert.doesNotMatch(desktop, /localStorage/);
  assert.match(page, /className="md:hidden"/);
  assert.match(page, /className="hidden md:block"/);
});

test("le numéro et le nom restent toujours visibles tandis que les autres informations sont optionnelles", () => {
  assert.match(mobile, /<NutravBadge nutrav=\{animal\.nutrav\}/);
  assert.match(mobile, /animal\.nobovi/);
  for (const key of ["age", "weight", "category", "mother", "father", "reproduction", "notWeaned", "group"]) {
    assert.match(mobile, new RegExp(`isVisible\\(\\"${key}\\"\\)`));
  }
});

test("l’affichage mobile ne montre Non sevrée que si nécessaire", () => {
  assert.match(mobile, /isVisible\("notWeaned"\) && !animal\.sevreFait/);
  assert.match(mobile, /🍼 Non sevrée/);
  assert.doesNotMatch(mobile, /✓ Sevrée/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(
  new URL("../app/api/sevrage-tarissement/route.ts", import.meta.url),
  "utf8",
);

test("WEAN_ONLY accepte un veau actif sans cycle et enregistre son sevrage", () => {
  assert.match(route, /action === "WEAN_ONLY" \|\| action === "UNDO_WEANING"/);
  assert.match(route, /where: \{ id: calfId, statut: "ACTIF" \}/);
  assert.match(route, /data: \{ sevreFait: true, dateSevrage: effectiveActionDate \}/);
  assert.match(route, /mother: mother[\s\S]*: null/);
});

test("sans cycle aucune mère n'est modifiée ni tarie automatiquement", () => {
  assert.match(route, /if \(currentCycle && mother\) \{[\s\S]*remainingCalves === 0/);
  assert.match(route, /if \(mustDryOff && mother && !mother\.tarieFaite\)/);
  assert.match(route, /let automaticDryOff = false/);
});

test("avec cycle le tarissement automatique actuel est conservé", () => {
  assert.match(route, /tx\.animal\.count/);
  assert.match(route, /automaticDryOff = !mother\.tarieFaite && remainingCalves === 0/);
  assert.match(route, /SEVRAGE_TARISSEMENT_AUTO/);
});

test("les actions nécessitant la mère restent refusées sans cycle", () => {
  const rejection = route.indexOf("if (!context && !allowsStandaloneCalf)");
  const standaloneLookup = route.indexOf("const standaloneCalf");
  assert.ok(rejection >= 0 && rejection < standaloneLookup);
  assert.match(route, /Le cycle mère–veau actuel n’a pas pu être établi/);
});

test("UNDO_WEANING sans cycle restaure le veau et le journal", () => {
  assert.match(route, /action === "UNDO_WEANING"/);
  assert.match(route, /data: \{ sevreFait: false, dateSevrage: null \}/);
  assert.match(route, /reverted: true, revertedAt: new Date\(\)/);
  assert.match(route, /cycleProgress: currentCycle[\s\S]*: null/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/troupeau/[nutrav]/page.tsx", import.meta.url), "utf8");
const tabs = source.slice(source.indexOf("{/* Onglets */}"), source.indexOf('<div className="p-3 space-y-3">', source.indexOf("{/* Onglets */}")));

test("les onglets de la fiche utilisent une navigation native fonctionnelle sans JS", () => {
  assert.match(tabs, /<a\s+key=\{tab\.id\}\s+href=\{tabHref\(tab\.id\)\}/);
  assert.match(tabs, /\{tab\.label\}/);
  assert.match(tabs, /<\/a>/);
});

test("l'onglet santé est accessible et ses données tolèrent une question supprimée", () => {
  assert.match(source, /\{ id: "sante", label: "Santé" \}/);
  assert.match(source, /onglet === "sante"/);
  assert.match(source, /r\.question\?\.type/);
});


test("la consultation Santé ne déclenche pas de synchronisation reproductive", () => {
  assert.match(source, /if \(onglet !== "sante"\) await syncAutomaticEchoRequests\(\)/);
  assert.match(source, /getAnimal\(nutrav, onglet\)/);
});

test("la santé affiche les traitements sans limite de dix et évite les calculs de croissance", () => {
  assert.match(source, /onglet === "sante" \? \{\} : \{ take: 10 \}/);
  assert.match(source, /onglet === "identite" && animal\.veaux\.length > 0/);
});

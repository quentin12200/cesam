import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("l'écran Vaccins ouvre sur la préparation et expose les trois espaces", () => {
  const page = read("app/sanitaire/vaccins/page.tsx");
  assert.match(page, />À préparer</);
  assert.match(page, />Protocoles</);
  assert.match(page, />Stock \/ flacons</);
  assert.match(page, /Imprimer la préparation/);
});

test("la feuille A4 est une lecture seule et contient les colonnes terrain", () => {
  const page = read("app/sanitaire/vaccins/impression/page.tsx");
  const loader = read("lib/vaccine-preparation-data.ts");
  assert.match(page, /size:A4 landscape/);
  assert.match(page, /Animal/);
  assert.match(page, /Injection/);
  assert.match(page, /Groupe \/ localisation/);
  assert.match(page, /Notes/);
  assert.doesNotMatch(loader, /\.create\(|\.update\(|\.delete\(/);
});

test("les statuts à confirmer sont sélectionnables et utilisent l'API existante", () => {
  const component = read("app/sanitaire/vaccins/StatutsAConfirmer.tsx");
  const loader = read("lib/vaccine-preparation-data.ts");
  assert.match(component, /Statut à confirmer/);
  assert.match(component, /Déjà primovaccinés/);
  assert.match(component, /Primo à faire/);
  assert.match(component, /api\/protocoles\/\$\{protocoleId\}\/statuts/);
  assert.match(loader, /statutsProtocolesVaccinaux/);
  assert.match(loader, /statutProtocole:/);
});

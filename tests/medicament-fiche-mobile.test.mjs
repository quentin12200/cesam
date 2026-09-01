import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const fiche = readFileSync(new URL("../app/pharmacie/[id]/MedicamentFicheClient.tsx", import.meta.url), "utf8");

test("les préconisations passent avant les blocs de gestion pharmacie", () => {
  const preconisations = fiche.indexOf("{/* Préconisations prioritaires */}");
  const conditionnements = fiche.indexOf("<ConditionnementsSection", preconisations);
  const conservation = fiche.indexOf("<ConservationOuvertureSection", preconisations);
  assert.ok(preconisations >= 0);
  assert.ok(conditionnements > preconisations);
  assert.ok(conservation > conditionnements);
});

test("la catégorie est prioritaire et le statut actif normal n'est pas affiché", () => {
  assert.match(fiche, /\{cat\.label\}/);
  assert.match(fiche, /text-sm font-semibold/);
  assert.doesNotMatch(fiche, />Actif</);
  assert.match(fiche, /!medicament\.actif.*Inactif/);
});

test("l'action sanitaire reste accessible sans gros bouton plein écran", () => {
  assert.match(fiche, /Créer un événement sanitaire/);
  assert.match(fiche, /inline-flex min-h-10/);
  assert.match(fiche, /border-blue-200 bg-blue-50/);
});

test("la voie est abrégée dans le pavé sans supprimer son libellé complet", () => {
  assert.match(fiche, /abregerVoie\(p\.voie\)/);
  assert.match(fiche, /overflow-hidden rounded-xl/);
  assert.match(fiche, /text-2xl leading-none/);
  assert.match(fiche, /break-words/);
  assert.match(fiche, /<b className="block text-gray-400 font-medium">Voie<\/b>\{formatVoie\(p\.voie\)\}/);
});

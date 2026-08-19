import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cleNomMarchand, formaterNomMarchand } from "../lib/marchands.ts";

const [schema, migration, api, suppression, select, sortieForm, simulation] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260819090000_marchands/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../app/api/marchands/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/marchands/[id]/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/finances/MarchandSelect.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/finances/SortieEditorModal.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/simulations-vente/[id]/vente/SimulationSaleForm.tsx", import.meta.url), "utf8"),
]);

test("la migration ajoute uniquement le référentiel Marchand", () => {
  assert.match(schema, /model Marchand[\s\S]*nom\s+String\s+@unique[\s\S]*createdAt/);
  assert.match(migration, /CREATE TABLE "Marchand"/);
  assert.match(migration, /CREATE UNIQUE INDEX "Marchand_nom_key"/);
  assert.doesNotMatch(migration, /ALTER TABLE "Sortie"|ALTER TABLE "VenteHistorique"/);
});

test("les anciennes ventes restent des suggestions texte indépendantes", () => {
  assert.match(api, /prisma\.sortie\.findMany/);
  assert.match(api, /prisma\.venteHistorique\.findMany/);
  assert.match(api, /suggestions/);
  assert.match(suppression, /prisma\.marchand\.deleteMany/);
  assert.doesNotMatch(suppression, /sortie\.(update|delete)|venteHistorique\.(update|delete)/);
});

test("le sélecteur permet ajout, sélection immédiate et suppression", () => {
  assert.match(select, /\+ Ajouter un marchand/);
  assert.match(select, /method: "POST"/);
  assert.match(select, /onChange\(marchand\.nom\)/);
  assert.match(select, /method: "DELETE"/);
  assert.match(select, /Les anciennes ventes restent inchangées/);
  assert.match(select, /Ajouter depuis les anciennes ventes/);
  assert.doesNotMatch(select, /<optgroup label="Acheteurs d’anciennes ventes"/);
  assert.match(select, /onClick=\{\(\) => void enregistrerMarchand\(nom\)\}/);
});

test("les noms sont affichés en majuscules et dédupliqués sans accents ni espaces", () => {
  assert.equal(formaterNomMarchand("  Privat "), "PRIVAT");
  assert.equal(formaterNomMarchand("cazals"), "CAZALS");
  assert.equal(cleNomMarchand("  Cézals  Père "), cleNomMarchand("CEZALS PERE"));
  assert.equal(new Set(["cazals", "CAZALS", " Cazals "].map(cleNomMarchand)).size, 1);
  assert.match(api, /formaterNomMarchand\(body\.nom\)/);
  assert.match(api, /suggestionsParCle/);
});

test("tous les parcours de vente réutilisent le sélecteur partagé", () => {
  assert.match(sortieForm, /MarchandSelect value=\{acheteur\}/);
  assert.match(sortieForm, /acheteur: nature === "VENTE" && acheteur \? acheteur : null/);
  assert.match(simulation, /SortieEditorModal/);
});

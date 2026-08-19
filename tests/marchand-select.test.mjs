import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(suppression, /prisma\.marchand\.delete/);
  assert.doesNotMatch(suppression, /sortie\.(update|delete)|venteHistorique\.(update|delete)/);
});

test("le sélecteur permet ajout, sélection immédiate et suppression", () => {
  assert.match(select, /\+ Ajouter un marchand/);
  assert.match(select, /method: "POST"/);
  assert.match(select, /onChange\(marchand\.nom\)/);
  assert.match(select, /method: "DELETE"/);
  assert.match(select, /Les anciennes ventes restent inchangées/);
  assert.match(select, /setSuggestions\(\(current\) => \[\.\.\.new Set\(\[marchand\.nom, \.\.\.current\]\)\]\)/);
  assert.doesNotMatch(select, /value === marchand\.nom\) onChange\(""\)/);
});

test("tous les parcours de vente réutilisent le sélecteur partagé", () => {
  assert.match(sortieForm, /MarchandSelect value=\{acheteur\}/);
  assert.match(sortieForm, /acheteur: nature === "VENTE" && acheteur \? acheteur : null/);
  assert.match(simulation, /SortieEditorModal/);
});

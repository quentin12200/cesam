import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [schema, migration, editor, createRoute, confirmation, session, menu] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260818120000_sale_simulations/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/simulations-vente/SaleSimulationEditor.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/sale-simulations/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/simulations-vente/[id]/vente/SimulationSaleForm.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/pesee/sessions/[id]/SessionDetailClient.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/MoreMenu.tsx", import.meta.url), "utf8"),
]);

test("la migration crée une simulation et ses lignes animales", () => {
  assert.match(schema, /model SaleSimulation \{/);
  assert.match(schema, /model SaleSimulationAnimal \{/);
  assert.match(migration, /CREATE TABLE "SaleSimulation"/);
  assert.match(migration, /CREATE TABLE "SaleSimulationAnimal"/);
});

test("la simulation s'enregistre sans créer de sortie", () => {
  assert.match(editor, /Enregistrer la simulation/);
  assert.match(editor, /\/api\/sale-simulations/);
  assert.doesNotMatch(createRoute, /sortie\.create|\/api\/sorties/);
});

test("le simulateur expose toutes les sources de poids et les calculs du lot", () => {
  for (const label of ["Dernière pesée", "Prédiction GMQ", "Poids marchand", "Poids manuel", "Réfaction"]) assert.match(editor, new RegExp(label));
  assert.match(editor, /Prix \(€\/kg\)/);
  assert.match(editor, /totalUsedWeight/);
  assert.match(editor, /totalRetainedWeight/);
  assert.match(editor, /averageAmount/);
});

test("la vente reste une confirmation séparée et réutilise la sortie groupée", () => {
  assert.match(editor, /Confirmer la vente/);
  assert.match(confirmation, /SortieEditorModal/);
  assert.match(confirmation, /fetch\("\/api\/sorties"/);
  assert.match(confirmation, /animalPrices, simulationId/);
});

test("le simulateur est accessible depuis une pesée et le troupeau", () => {
  assert.match(session, /simulations-vente\/nouvelle\?sessionId=/);
  assert.match(menu, /Simulations de vente/);
});

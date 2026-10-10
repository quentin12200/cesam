import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("la séance mémorise la branche choisie à la date réelle de Primo et l'inclut dans l'annulation", () => {
  const route = source("app/api/evenements/batch/route.ts");
  assert.match(route, /choisirBrancheAgePrimo\(configuration, dateNaissance, resolvedDate\)/);
  assert.match(route, /brancheInitialeId: avant\.brancheInitialeId/);
});

test("suppression et correction d'actes resynchronisent le statut et la branche", () => {
  assert.match(source("app/api/vaccinations/[id]/route.ts"), /resynchroniserStatutProtocole/);
  const traitements = source("app/api/traitements/[id]/route.ts");
  assert.ok((traitements.match(/resynchroniserStatutProtocole/g) ?? []).length >= 3);
  assert.match(source("lib/vaccine-statut-sync.ts"), /brancheInitialeDepuisActes/);
});

test("la migration reste strictement additive", () => {
  const migration = source("prisma/migrations/20261010120000_protocoles_questionnaire/migration.sql");
  assert.match(migration, /ADD COLUMN "configurationQuestionnaireJson" TEXT/);
  assert.match(migration, /ADD COLUMN "brancheInitialeId" TEXT/);
  assert.doesNotMatch(migration, /DROP|DELETE|UPDATE|RENAME/i);
});

test("l'édition conserve les identités d'étape et refuse la suppression d'une étape historisée", () => {
  const route = source("app/api/protocoles/[id]/route.ts");
  assert.match(route, /etapeProtocoleVaccin\.upsert/);
  assert.match(route, /Une étape déjà utilisée ne peut pas être supprimée/);
});

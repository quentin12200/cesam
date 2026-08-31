import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../prisma/migrations/20260828120000_vaccine_planner_foundations/migration.sql", import.meta.url),
  "utf8"
);

test("les anciens Vaccination restent valides avec des liens optionnels", () => {
  for (const field of ["medicamentId", "protocoleId", "etapeProtocoleId", "gestationId", "typeInjection"]) {
    assert.match(schema, new RegExp(`${field}\\s+String\\?`));
    assert.match(migration, new RegExp(`ADD COLUMN "${field}" TEXT`));
    assert.doesNotMatch(migration, new RegExp(`ADD COLUMN "${field}" TEXT NOT NULL`));
  }
  assert.match(schema, /vaccin\s+String/);
});

test("le statut protocole est unique par animal et protocole", () => {
  assert.match(schema, /model StatutProtocoleVaccinal[\s\S]*@@unique\(\[animalId, protocoleId\]\)/);
  assert.match(migration, /UNIQUE INDEX "StatutProtocoleVaccinal_animalId_protocoleId_key"/);
});

test("Vaccination référence l'étape et la gestation sans les rendre obligatoires", () => {
  assert.match(schema, /etapeProtocole\s+EtapeProtocoleVaccin\?/);
  assert.match(schema, /gestation\s+Gestation\?/);
  assert.match(migration, /EtapeProtocoleVaccin"\("id"\) ON DELETE SET NULL/);
  assert.match(migration, /Gestation"\("id"\) ON DELETE SET NULL/);
});

test("le flacon ne stocke pas de compteur dosesRestantes", () => {
  const model = schema.match(/model FlaconMedicamentOuvert \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(model, /dosesInitiales\s+Float/);
  assert.doesNotMatch(model, /dosesRestantes/);
  assert.match(schema, /model UtilisationFlaconVaccin[\s\S]*dosesUtilisees\s+Float/);
});

test("une utilisation est supprimée avec la vaccination pour éviter une consommation fantôme", () => {
  assert.match(schema, /vaccination\s+Vaccination\?[\s\S]*onDelete: Cascade/);
  assert.match(migration, /UtilisationFlaconVaccin_vaccinationId_fkey[\s\S]*ON DELETE CASCADE/);
});

test("les index correspondent aux recherches du planificateur", () => {
  for (const field of ["medicamentId", "protocoleId", "etapeProtocoleId", "gestationId"]) {
    assert.match(schema, new RegExp(`@@index\\(\\[${field}\\]\\)`));
  }
  assert.match(schema, /@@index\(\[medicamentId, statut\]\)/);
  assert.match(schema, /@@index\(\[statut, dateLimiteUtilisation\]\)/);
  assert.match(schema, /model UtilisationFlaconVaccin[\s\S]*@@index\(\[flaconId, date\]\)[\s\S]*@@index\(\[vaccinationId\]\)/);
});

test("les règles de conservation permettent héritage et override explicite", () => {
  assert.match(schema, /model Medicament[\s\S]*conservationOuvertureStatut\s+String\s+@default\("INCONNUE"\)/);
  assert.match(schema, /model ConditionnementMedicament[\s\S]*conservationOuvertureStatut\s+String\?/);
});

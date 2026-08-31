import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../prisma/migrations/20260828120000_vaccine_planner_foundations/migration.sql", import.meta.url),
  "utf8"
);

test("la migration additive conserve une Vaccination historique et crée les fondations", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    for (const statement of [
      `CREATE TABLE "Animal" ("id" TEXT PRIMARY KEY, "nutrav" TEXT NOT NULL)`,
      `CREATE TABLE "ProtocoleVaccin" ("id" TEXT PRIMARY KEY)`,
      `CREATE TABLE "EtapeProtocoleVaccin" ("id" TEXT PRIMARY KEY)`,
      `CREATE TABLE "Gestation" ("id" TEXT PRIMARY KEY)`,
      `CREATE TABLE "Medicament" ("id" TEXT PRIMARY KEY)`,
      `CREATE TABLE "ConditionnementMedicament" ("id" TEXT PRIMARY KEY, "medicamentId" TEXT NOT NULL)`,
      `CREATE TABLE "Vaccination" ("id" TEXT PRIMARY KEY, "animalId" TEXT NOT NULL, "vaccin" TEXT NOT NULL, "date" DATETIME NOT NULL, "voie" TEXT)`,
      `INSERT INTO "Animal" ("id", "nutrav") VALUES ('animal-1', '7483')`,
      `INSERT INTO "Vaccination" ("id", "animalId", "vaccin", "date") VALUES ('vaccination-ancienne', 'animal-1', 'ROTAVEC', '2026-01-01')`,
    ]) await client.execute(statement);

    const statements = migration.replace(/--[^\n]*/g, "").split(";").map((value) => value.trim()).filter(Boolean);
    for (const statement of statements) await client.execute(statement);

    const ancienne = await client.execute(`SELECT "vaccin", "medicamentId", "etapeProtocoleId", "gestationId" FROM "Vaccination" WHERE "id" = 'vaccination-ancienne'`);
    assert.equal(ancienne.rows[0].vaccin, "ROTAVEC");
    assert.equal(ancienne.rows[0].medicamentId, null);
    assert.equal(ancienne.rows[0].etapeProtocoleId, null);
    assert.equal(ancienne.rows[0].gestationId, null);

    await client.execute(`INSERT INTO "ProtocoleVaccin" ("id") VALUES ('protocole-1')`);
    await client.execute(`INSERT INTO "EtapeProtocoleVaccin" ("id") VALUES ('etape-primo-1')`);
    await client.execute(`INSERT INTO "Gestation" ("id") VALUES ('gestation-1')`);
    await client.execute(`UPDATE "Vaccination" SET "protocoleId" = 'protocole-1', "etapeProtocoleId" = 'etape-primo-1', "gestationId" = 'gestation-1', "typeInjection" = 'PRIMO_1' WHERE "id" = 'vaccination-ancienne'`);
    const rattachement = await client.execute(`SELECT "etapeProtocoleId", "gestationId", "typeInjection" FROM "Vaccination" WHERE "id" = 'vaccination-ancienne'`);
    assert.equal(rattachement.rows[0].etapeProtocoleId, "etape-primo-1");
    assert.equal(rattachement.rows[0].gestationId, "gestation-1");
    assert.equal(rattachement.rows[0].typeInjection, "PRIMO_1");

    await client.execute(`INSERT INTO "StatutProtocoleVaccinal" ("id", "animalId", "protocoleId", "updatedAt") VALUES ('statut-1', 'animal-1', 'protocole-1', CURRENT_TIMESTAMP)`);
    await assert.rejects(
      client.execute(`INSERT INTO "StatutProtocoleVaccinal" ("id", "animalId", "protocoleId", "updatedAt") VALUES ('statut-2', 'animal-1', 'protocole-1', CURRENT_TIMESTAMP)`)
    );

    await client.execute(`INSERT INTO "Medicament" ("id", "conservationOuvertureStatut", "conservationOuvertureJours") VALUES ('med-1', 'CONSERVABLE', 28)`);
    await client.execute(`INSERT INTO "ConditionnementMedicament" ("id", "medicamentId", "conservationOuvertureStatut") VALUES ('conditionnement-1', 'med-1', 'INCONNUE')`);
    const conservation = await client.execute(`SELECT "conservationOuvertureStatut" FROM "ConditionnementMedicament" WHERE "id" = 'conditionnement-1'`);
    assert.equal(conservation.rows[0].conservationOuvertureStatut, "INCONNUE");
    await client.execute(`INSERT INTO "FlaconMedicamentOuvert" ("id", "medicamentId", "dateOuverture", "dosesInitiales", "updatedAt") VALUES ('flacon-1', 'med-1', '2026-09-05', 20, CURRENT_TIMESTAMP)`);
    await client.execute(`INSERT INTO "UtilisationFlaconVaccin" ("id", "flaconId", "vaccinationId", "date", "dosesUtilisees") VALUES ('usage-1', 'flacon-1', 'vaccination-ancienne', '2026-09-05', 1)`);
    const usages = await client.execute(`SELECT SUM("dosesUtilisees") AS "total" FROM "UtilisationFlaconVaccin" WHERE "flaconId" = 'flacon-1'`);
    assert.equal(Number(usages.rows[0].total), 1);

    await client.execute(`DELETE FROM "Vaccination" WHERE "id" = 'vaccination-ancienne'`);
    const usagesApresSuppression = await client.execute(`SELECT COUNT(*) AS "total" FROM "UtilisationFlaconVaccin" WHERE "flaconId" = 'flacon-1'`);
    assert.equal(Number(usagesApresSuppression.rows[0].total), 0);

    await client.execute(`INSERT INTO "Vaccination" ("id", "animalId", "vaccin", "date") VALUES ('vaccination-historique', 'animal-1', 'ANCIEN VACCIN', '2025-01-01')`);
    await client.execute(`UPDATE "Vaccination" SET "voie" = 'SC' WHERE "id" = 'vaccination-historique'`);
    const historique = await client.execute(`SELECT "voie", "protocoleId", "etapeProtocoleId", "gestationId", "typeInjection" FROM "Vaccination" WHERE "id" = 'vaccination-historique'`);
    assert.equal(historique.rows[0].voie, "SC");
    assert.equal(historique.rows[0].protocoleId, null);
    assert.equal(historique.rows[0].etapeProtocoleId, null);
    assert.equal(historique.rows[0].gestationId, null);
    assert.equal(historique.rows[0].typeInjection, null);
    await client.execute(`DELETE FROM "Vaccination" WHERE "id" = 'vaccination-historique'`);
    const historiqueSupprime = await client.execute(`SELECT COUNT(*) AS "total" FROM "Vaccination" WHERE "id" = 'vaccination-historique'`);
    assert.equal(Number(historiqueSupprime.rows[0].total), 0);
  } finally {
    client.close();
  }
});

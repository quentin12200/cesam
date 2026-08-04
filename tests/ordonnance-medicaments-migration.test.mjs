import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";

test("la migration recopie le lien historique sans perdre l'ordonnance", async () => {
  const client = createClient({ url: "file::memory:" });
  const applyLikeProduction = async (sql) => {
    const statements = sql
      .replace(/--[^\n]*/g, "")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) await client.execute(statement);
  };
  try {
    await client.executeMultiple(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE "Medicament" ("id" TEXT NOT NULL PRIMARY KEY);
      CREATE TABLE "Ordonnance" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "medicamentId" TEXT,
        "medicamentNom" TEXT NOT NULL DEFAULT '',
        "substanceActive" TEXT, "concentration" TEXT, "categorieMedicament" TEXT,
        "familleTherapeutique" TEXT, "formePharmaceutique" TEXT, "conditionnement" TEXT,
        "dose" REAL, "uniteDosage" TEXT, "referenceValue" REAL, "referenceUnit" TEXT,
        "referenceType" TEXT, "normalizedDoseValue" REAL, "normalizedDoseUnit" TEXT,
        "voie" TEXT, "dureeJours" INTEGER, "administrationCount" INTEGER,
        "administrationIntervalHours" INTEGER, "repeatCondition" TEXT,
        "administrationInstructions" TEXT, "delaiAttenteViandeJ" INTEGER,
        "delaiAttenteAbatsJ" INTEGER, "delaiAttenteLaitJ" INTEGER, "precautions" TEXT,
        "extractionStructuree" TEXT, "createdAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL,
        FOREIGN KEY ("medicamentId") REFERENCES "Medicament"("id") ON DELETE SET NULL
      );
      INSERT INTO "Medicament" ("id") VALUES ('med-1');
      INSERT INTO "Ordonnance" (
        "id", "medicamentId", "medicamentNom", "dose", "uniteDosage", "voie",
        "delaiAttenteViandeJ", "delaiAttenteLaitJ", "createdAt", "updatedAt"
      ) VALUES (
        'ord-1', 'med-1', 'TENALINE LA', 1, 'ml', 'IM', 21, 7,
        '2026-08-03T00:00:00.000Z', '2026-08-03T00:00:00.000Z'
      );
    `);

    const migration = await readFile(
      new URL("../prisma/migrations/20260804090000_ordonnance_medicaments_relation/migration.sql", import.meta.url),
      "utf8",
    );
    await applyLikeProduction(migration);
    await applyLikeProduction(migration);

    const ordonnance = await client.execute("SELECT * FROM Ordonnance WHERE id = 'ord-1'");
    const liens = await client.execute("SELECT * FROM OrdonnanceMedicament WHERE ordonnanceId = 'ord-1'");
    assert.equal(ordonnance.rows.length, 1);
    assert.equal(ordonnance.rows[0].medicamentId, "med-1");
    assert.equal(liens.rows.length, 1);
    assert.equal(liens.rows[0].medicamentId, "med-1");
    assert.equal(liens.rows[0].nomExtrait, "TENALINE LA");
    assert.equal(liens.rows[0].statutCorrespondance, "manually_confirmed");
  } finally {
    await client.close();
  }
});

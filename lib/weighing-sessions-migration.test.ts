import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createClient } from "@libsql/client";

const migration = readFileSync(
  new URL("../prisma/migrations/20260801132000_weighing_sessions/migration.sql", import.meta.url),
  "utf8",
);

function statements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

test("la migration additive protège les séances et conserve les anciennes pesées", async () => {
  const db = createClient({ url: ":memory:" });
  try {
    await db.execute("PRAGMA foreign_keys = ON");
    await db.execute('CREATE TABLE "Animal" ("id" TEXT NOT NULL PRIMARY KEY)');
    await db.execute(`CREATE TABLE "Pesee" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "animalId" TEXT NOT NULL,
      "date" DATETIME NOT NULL,
      "poids" REAL NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("animalId") REFERENCES "Animal" ("id")
    )`);
    await db.execute({ sql: 'INSERT INTO "Animal" ("id") VALUES (?), (?)', args: ["a1", "a2"] });
    await db.execute({
      sql: 'INSERT INTO "Pesee" ("id", "animalId", "date", "poids", "updatedAt") VALUES (?, ?, ?, ?, ?)',
      args: ["legacy", "a1", "2026-07-01T12:00:00.000Z", 300, "2026-07-01T12:00:00.000Z"],
    });

    for (const statement of statements(migration)) await db.execute(statement);

    const legacy = await db.execute('SELECT "weighingSessionId" FROM "Pesee" WHERE "id" = \'legacy\'');
    assert.equal(legacy.rows[0].weighingSessionId, null);
    await db.execute({
      sql: 'INSERT INTO "Pesee" ("id", "animalId", "date", "poids", "updatedAt") VALUES (?, ?, ?, ?, ?)',
      args: ["legacy2", "a1", "2026-07-02T12:00:00.000Z", 305, "2026-07-02T12:00:00.000Z"],
    });

    const concurrent = await Promise.allSettled([
      db.execute('INSERT INTO "WeighingSession" ("id", "status", "updatedAt") VALUES (\'s1\', \'ACTIVE\', CURRENT_TIMESTAMP)'),
      db.execute('INSERT INTO "WeighingSession" ("id", "status", "updatedAt") VALUES (\'s2\', \'ACTIVE\', CURRENT_TIMESTAMP)'),
    ]);
    assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
    const active = await db.execute('SELECT "id" FROM "WeighingSession" WHERE "status" = \'ACTIVE\'');
    assert.equal(active.rows.length, 1);
    const activeId = String(active.rows[0].id);
    await assert.rejects(db.execute(
      'INSERT INTO "WeighingSession" ("id", "status", "endedAt", "updatedAt") VALUES (\'invalid-active\', \'ACTIVE\', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    ));

    await db.execute({
      sql: 'INSERT INTO "Pesee" ("id", "animalId", "weighingSessionId", "date", "poids", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)',
      args: ["p1", "a1", activeId, "2026-08-01T12:00:00.000Z", 350, "2026-08-01T12:00:00.000Z"],
    });
    await assert.rejects(db.execute({
      sql: 'INSERT INTO "Pesee" ("id", "animalId", "weighingSessionId", "date", "poids", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)',
      args: ["p2", "a1", activeId, "2026-08-01T12:00:00.000Z", 351, "2026-08-01T12:00:00.000Z"],
    }));

    await db.execute({
      sql: 'UPDATE "Pesee" SET "poids" = ? WHERE "id" = ?',
      args: [360, "p1"],
    });
    await db.execute({
      sql: 'UPDATE "WeighingSession" SET "status" = ?, "endedAt" = ?, "updatedAt" = ? WHERE "id" = ?',
      args: ["FINISHED", "2026-08-01T10:00:00.000Z", "2026-08-01T10:00:00.000Z", activeId],
    });
    const retained = await db.execute('SELECT "poids" FROM "Pesee" WHERE "id" = \'p1\'');
    assert.equal(Number(retained.rows[0].poids), 360);
    await assert.rejects(db.execute(
      'INSERT INTO "Pesee" ("id", "animalId", "weighingSessionId", "date", "poids", "updatedAt") VALUES (\'late\', \'a2\', \'missing\', CURRENT_TIMESTAMP, 300, CURRENT_TIMESTAMP)',
    ));

    await db.execute('INSERT INTO "WeighingSession" ("id", "status", "updatedAt") VALUES (\'s3\', \'ACTIVE\', CURRENT_TIMESTAMP)');
    await db.execute('UPDATE "WeighingSession" SET "status" = \'ABANDONED\', "endedAt" = CURRENT_TIMESTAMP WHERE "id" = \'s3\'');
    const sessions = await db.execute('SELECT "status" FROM "WeighingSession" ORDER BY "startedAt" DESC, "id" DESC');
    assert.deepEqual(sessions.rows.map((row) => row.status).sort(), ["ABANDONED", "FINISHED"]);
  } finally {
    db.close();
  }
});

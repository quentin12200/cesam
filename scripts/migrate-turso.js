const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const url = process.env.DATABASE_URL ?? "libsql://cesam-quentin12200.aws-eu-west-1.turso.io";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, ...(authToken ? { authToken } : {}) });

async function execSql(sql) {
  const stmts = sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of stmts) {
    try {
      await client.execute(stmt);
    } catch (e) {
      const msg = String(e.message ?? e);
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate column") ||
        msg.includes("no such column: _prisma_migrations")
      ) {
        continue;
      }
      throw new Error(`Statement failed: ${msg}\n  SQL: ${stmt.slice(0, 120)}`);
    }
  }
}

async function main() {
  // Ensure migration tracking table exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                  TEXT PRIMARY KEY,
      "checksum"            TEXT NOT NULL,
      "finished_at"         DATETIME,
      "migration_name"      TEXT UNIQUE NOT NULL,
      "logs"                TEXT,
      "rolled_back_at"      DATETIME,
      "started_at"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);

  const migrationsDir = path.join(process.cwd(), "prisma/migrations");
  const migrations = fs
    .readdirSync(migrationsDir)
    .filter((e) => {
      const p = path.join(migrationsDir, e);
      return (
        fs.statSync(p).isDirectory() &&
        fs.existsSync(path.join(p, "migration.sql"))
      );
    })
    .sort();

  console.log(`Found ${migrations.length} migration(s).`);

  for (const name of migrations) {
    const row = await client.execute({
      sql: "SELECT id FROM _prisma_migrations WHERE migration_name = ? AND finished_at IS NOT NULL",
      args: [name],
    });

    if (row.rows.length > 0) {
      console.log(`  ✓ ${name}`);
      continue;
    }

    const sqlFile = path.join(migrationsDir, name, "migration.sql");
    const sql = fs.readFileSync(sqlFile, "utf-8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");

    console.log(`  → Applying ${name}...`);
    await execSql(sql);

    await client.execute({
      sql: `INSERT OR REPLACE INTO "_prisma_migrations"
              (id, checksum, migration_name, finished_at, applied_steps_count)
            VALUES (?, ?, ?, datetime('now'), 1)`,
      args: [crypto.randomUUID(), checksum, name],
    });

    console.log(`  ✓ ${name} applied`);
  }

  console.log("All migrations up to date.");
  client.close();
}

main().catch((e) => {
  const msg = String(e.message ?? e);
  // Non-fatal when DB is unreachable (local dev, preview envs without DB access)
  if (msg.includes("403") || msg.includes("allowlist") || msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
    console.warn("Migration skipped: DB unreachable in this environment.");
    process.exit(0);
  }
  console.error("Migration failed:", e);
  process.exit(1);
});

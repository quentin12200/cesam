const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

const client = createClient({
  url: "libsql://cesam-quentin12200.aws-eu-west-1.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const migrationPath = path.join(
    process.cwd(),
    "prisma/migrations/20260522082327_init/migration.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf-8");

  // Split on semicolons to execute statement by statement
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`📦 Application de ${statements.length} statements SQL sur Turso...`);

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log(`⚠️  Table déjà existante, ignorée`);
      } else {
        console.error(`❌ Erreur: ${e.message}`);
        console.error(`   Statement: ${stmt.substring(0, 80)}...`);
      }
    }
  }
  console.log("✅ Migrations appliquées");
  client.close();
}

main().catch(console.error);

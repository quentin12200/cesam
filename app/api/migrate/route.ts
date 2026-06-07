import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const results: string[] = [];
  const migrations = [
    `ALTER TABLE "StatsAnnuelle" ADD COLUMN "veauxMCount" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "StatsAnnuelle" ADD COLUMN "veauxFCount" INTEGER NOT NULL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS "VenteHistorique" ("id" TEXT NOT NULL PRIMARY KEY,"annee" INTEGER NOT NULL,"typeAnimal" TEXT NOT NULL,"typeVente" TEXT NOT NULL,"nutrav" TEXT,"sexe" TEXT,"poidsVif" REAL,"prixKgVif" REAL,"poidsCarc" REAL,"prixKgCarc" REAL,"acheteur" TEXT,"date" DATETIME NOT NULL,"total" REAL,"notes" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL)`,
  ];
  for (const sql of migrations) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push(`✓ ${sql.slice(0, 60)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate column") || msg.includes("already exists")) {
        results.push(`skip (déjà existant): ${sql.slice(0, 60)}`);
      } else {
        results.push(`✗ ${msg}`);
      }
    }
  }
  return NextResponse.json({ results });
}

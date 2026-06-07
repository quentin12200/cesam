CREATE TABLE "StatsAnnuelle" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "annee" INTEGER NOT NULL,
  "veauxCount" INTEGER NOT NULL DEFAULT 0,
  "veauxKgTotal" REAL NOT NULL DEFAULT 0,
  "veauxPrixMoyen" REAL,
  "veauxCA" REAL NOT NULL DEFAULT 0,
  "vachesCount" INTEGER NOT NULL DEFAULT 0,
  "vachesKgCarcasse" REAL NOT NULL DEFAULT 0,
  "vachesPrixMoyen" REAL,
  "vachesCA" REAL NOT NULL DEFAULT 0,
  "velagesCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "StatsAnnuelle_annee_key" ON "StatsAnnuelle"("annee");

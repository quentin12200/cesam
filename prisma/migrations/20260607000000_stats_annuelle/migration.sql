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

ALTER TABLE "StatsAnnuelle" ADD COLUMN "veauxMCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StatsAnnuelle" ADD COLUMN "veauxFCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "VenteHistorique" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "annee" INTEGER NOT NULL,
  "typeAnimal" TEXT NOT NULL,
  "typeVente" TEXT NOT NULL,
  "nutrav" TEXT,
  "sexe" TEXT,
  "poidsVif" REAL,
  "prixKgVif" REAL,
  "poidsCarc" REAL,
  "prixKgCarc" REAL,
  "acheteur" TEXT,
  "date" DATETIME NOT NULL,
  "total" REAL,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

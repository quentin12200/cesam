-- Stock fields on Medicament
ALTER TABLE "Medicament" ADD COLUMN "stockActuel" REAL;
ALTER TABLE "Medicament" ADD COLUMN "stockUnite" TEXT;
ALTER TABLE "Medicament" ADD COLUMN "stockSeuilAlert" REAL;

-- ExploitationConfig (singleton)
CREATE TABLE "ExploitationConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ipg" TEXT,
  "raisonSociale" TEXT,
  "adresse" TEXT,
  "telephone" TEXT,
  "veterinaireNom" TEXT,
  "veterinaireAdresse" TEXT,
  "veterinaireTel" TEXT,
  "ordonnancierNo" TEXT,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ordonnances
CREATE TABLE "Ordonnance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "numero" TEXT,
  "veterinaireNom" TEXT,
  "medicamentNom" TEXT NOT NULL DEFAULT '',
  "dose" REAL,
  "uniteDosage" TEXT,
  "voie" TEXT,
  "dureeJours" INTEGER,
  "motif" TEXT,
  "animaux" TEXT,
  "statut" TEXT NOT NULL DEFAULT 'VALIDE',
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

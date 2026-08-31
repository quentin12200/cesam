ALTER TABLE "Vaccination" ADD COLUMN "medicamentId" TEXT REFERENCES "Medicament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vaccination" ADD COLUMN "protocoleId" TEXT REFERENCES "ProtocoleVaccin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vaccination" ADD COLUMN "etapeProtocoleId" TEXT REFERENCES "EtapeProtocoleVaccin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vaccination" ADD COLUMN "gestationId" TEXT REFERENCES "Gestation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vaccination" ADD COLUMN "typeInjection" TEXT;

CREATE INDEX "Vaccination_medicamentId_idx" ON "Vaccination"("medicamentId");
CREATE INDEX "Vaccination_protocoleId_idx" ON "Vaccination"("protocoleId");
CREATE INDEX "Vaccination_etapeProtocoleId_idx" ON "Vaccination"("etapeProtocoleId");
CREATE INDEX "Vaccination_gestationId_idx" ON "Vaccination"("gestationId");

ALTER TABLE "Medicament" ADD COLUMN "conservationOuvertureStatut" TEXT NOT NULL DEFAULT 'INCONNUE';
ALTER TABLE "Medicament" ADD COLUMN "conservationOuvertureJours" INTEGER;
ALTER TABLE "Medicament" ADD COLUMN "conservationOuvertureCondition" TEXT;
ALTER TABLE "Medicament" ADD COLUMN "conservationOuvertureSource" TEXT;
ALTER TABLE "Medicament" ADD COLUMN "conservationOuvertureNote" TEXT;

ALTER TABLE "ConditionnementMedicament" ADD COLUMN "conservationOuvertureStatut" TEXT;
ALTER TABLE "ConditionnementMedicament" ADD COLUMN "conservationOuvertureJours" INTEGER;
ALTER TABLE "ConditionnementMedicament" ADD COLUMN "conservationOuvertureCondition" TEXT;
ALTER TABLE "ConditionnementMedicament" ADD COLUMN "conservationOuvertureSource" TEXT;
ALTER TABLE "ConditionnementMedicament" ADD COLUMN "conservationOuvertureNote" TEXT;

CREATE TABLE "StatutProtocoleVaccinal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "animalId" TEXT NOT NULL,
  "protocoleId" TEXT NOT NULL,
  "statut" TEXT NOT NULL DEFAULT 'A_CONFIRMER',
  "source" TEXT NOT NULL DEFAULT 'MANUEL',
  "confirmeAt" DATETIME,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StatutProtocoleVaccinal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StatutProtocoleVaccinal_protocoleId_fkey" FOREIGN KEY ("protocoleId") REFERENCES "ProtocoleVaccin"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StatutProtocoleVaccinal_animalId_protocoleId_key" ON "StatutProtocoleVaccinal"("animalId", "protocoleId");
CREATE INDEX "StatutProtocoleVaccinal_protocoleId_statut_idx" ON "StatutProtocoleVaccinal"("protocoleId", "statut");

CREATE TABLE "FlaconMedicamentOuvert" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "medicamentId" TEXT NOT NULL,
  "conditionnementId" TEXT,
  "dateOuverture" DATETIME NOT NULL,
  "dosesInitiales" REAL NOT NULL,
  "conservationJours" INTEGER,
  "dateLimiteUtilisation" DATETIME,
  "conditionConservation" TEXT,
  "sourceConservation" TEXT,
  "statut" TEXT NOT NULL DEFAULT 'OUVERT',
  "numeroLot" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FlaconMedicamentOuvert_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "Medicament"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FlaconMedicamentOuvert_conditionnementId_fkey" FOREIGN KEY ("conditionnementId") REFERENCES "ConditionnementMedicament"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "FlaconMedicamentOuvert_medicamentId_statut_idx" ON "FlaconMedicamentOuvert"("medicamentId", "statut");
CREATE INDEX "FlaconMedicamentOuvert_conditionnementId_idx" ON "FlaconMedicamentOuvert"("conditionnementId");
CREATE INDEX "FlaconMedicamentOuvert_statut_dateLimiteUtilisation_idx" ON "FlaconMedicamentOuvert"("statut", "dateLimiteUtilisation");

CREATE TABLE "UtilisationFlaconVaccin" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "flaconId" TEXT NOT NULL,
  "vaccinationId" TEXT,
  "date" DATETIME NOT NULL,
  "dosesUtilisees" REAL NOT NULL,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UtilisationFlaconVaccin_flaconId_fkey" FOREIGN KEY ("flaconId") REFERENCES "FlaconMedicamentOuvert"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UtilisationFlaconVaccin_vaccinationId_fkey" FOREIGN KEY ("vaccinationId") REFERENCES "Vaccination"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UtilisationFlaconVaccin_flaconId_date_idx" ON "UtilisationFlaconVaccin"("flaconId", "date");
CREATE INDEX "UtilisationFlaconVaccin_vaccinationId_idx" ON "UtilisationFlaconVaccin"("vaccinationId");

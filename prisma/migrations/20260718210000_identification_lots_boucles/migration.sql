ALTER TABLE "Animal" ADD COLUMN "numeroNational" TEXT;
CREATE UNIQUE INDEX "Animal_numeroNational_key" ON "Animal"("numeroNational");
UPDATE "Animal" SET "numeroNational" = "nunati" WHERE "nunati" NOT LIKE 'AUTO%';

ALTER TABLE "VeauVelage" ADD COLUMN "nunati" TEXT;

ALTER TABLE "ExploitationConfig" ADD COLUMN "identificationMode" TEXT NOT NULL DEFAULT 'TRAVAIL_ET_NATIONAL';
ALTER TABLE "ExploitationConfig" ADD COLUMN "nutravNbChiffres" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "ExploitationConfig" ADD COLUMN "nutravZerosGauche" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ExploitationConfig" ADD COLUMN "propositionAutoNumero" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ExploitationConfig" ADD COLUMN "serieCommuneSexes" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ExploitationConfig" ADD COLUMN "serviceDeclaration" TEXT NOT NULL DEFAULT 'AUCUN';

CREATE TABLE "LotBoucles" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reference" TEXT,
  "premierNutrav" TEXT NOT NULL,
  "premierNunati" TEXT NOT NULL,
  "quantite" INTEGER NOT NULL,
  "prochainIndex" INTEGER NOT NULL DEFAULT 0,
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "DeclarationAdministrative" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "animalId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'NAISSANCE',
  "statut" TEXT NOT NULL DEFAULT 'A_DECLARER',
  "service" TEXT NOT NULL DEFAULT 'AUCUN',
  "referenceExterne" TEXT,
  "erreur" TEXT,
  "donneesTransmises" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DeclarationAdministrative_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DeclarationAdministrative_animalId_statut_idx" ON "DeclarationAdministrative"("animalId", "statut");

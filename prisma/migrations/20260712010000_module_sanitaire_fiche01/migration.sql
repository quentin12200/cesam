-- EvenementSanitaire: temperature + symptomes
ALTER TABLE "EvenementSanitaire" ADD COLUMN "temperature" REAL;

CREATE TABLE "EvenementSymptome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evenementId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "groupe" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvenementSymptome_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "EvenementSanitaire" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Medicament
ALTER TABLE "Medicament" ADD COLUMN "temporaire" BOOLEAN NOT NULL DEFAULT false;

-- Traitement
ALTER TABLE "Traitement" ADD COLUMN "evenementId" TEXT;
ALTER TABLE "Traitement" ADD COLUMN "frequence" TEXT;
ALTER TABLE "Traitement" ADD COLUMN "doseRecommandee" REAL;
ALTER TABLE "Traitement" ADD COLUMN "poidsUtilise" REAL;
ALTER TABLE "Traitement" ADD COLUMN "ordonnanceAAssocier" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Traitement" ADD COLUMN "delaiAttenteViandeJ" INTEGER;
ALTER TABLE "Traitement" ADD COLUMN "delaiAttenteLaitJ" INTEGER;

-- ExploitationConfig
ALTER TABLE "ExploitationConfig" ADD COLUMN "affichageDelaiAttente" TEXT NOT NULL DEFAULT 'LES_DEUX';

-- Ordonnance
ALTER TABLE "Ordonnance" ADD COLUMN "frequence" TEXT;
ALTER TABLE "Ordonnance" ADD COLUMN "delaiAttenteViandeJ" INTEGER;
ALTER TABLE "Ordonnance" ADD COLUMN "delaiAttenteLaitJ" INTEGER;
ALTER TABLE "Ordonnance" ADD COLUMN "precautions" TEXT;
ALTER TABLE "Ordonnance" ADD COLUMN "rappels" TEXT;

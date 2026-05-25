-- CreateTable
CREATE TABLE "Groupe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "couleur" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Groupe_nom_key" ON "Groupe"("nom");

-- AlterTable Animal: add categorie, groupeId, aEchographier
ALTER TABLE "Animal" ADD COLUMN "categorie" TEXT;
ALTER TABLE "Animal" ADD COLUMN "groupeId" TEXT;
ALTER TABLE "Animal" ADD COLUMN "aEchographier" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Sortie: add causeMortalite
ALTER TABLE "Sortie" ADD COLUMN "causeMortalite" TEXT;

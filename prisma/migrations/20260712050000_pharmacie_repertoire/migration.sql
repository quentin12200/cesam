-- Refonte du répertoire Pharmacie : favoris, actions simples, glossaire
-- "En savoir +" et nouvelle taxonomie de catégories (14 valeurs, une seule
-- catégorie principale par médicament).

ALTER TABLE "Medicament" ADD COLUMN "favori" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Medicament" ADD COLUMN "actions" TEXT;

CREATE TABLE "MedicamentTerme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medicamentId" TEXT NOT NULL,
    "terme" TEXT NOT NULL,
    "explication" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedicamentTerme_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "Medicament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MedicamentTerme_medicamentId_idx" ON "MedicamentTerme"("medicamentId");

-- Remap de l'ancienne taxonomie (6 valeurs) vers la nouvelle (14 valeurs).
-- ANTIBIOTIQUE, ANTIPARASITAIRE et AUTRE gardent le même code.
UPDATE "Medicament" SET "categorie" = 'ANTI_INFLAMMATOIRE' WHERE "categorie" = 'ANTIDOULEUR';
UPDATE "Medicament" SET "categorie" = 'CORTISONE' WHERE "categorie" = 'CORTICOIDE';
UPDATE "Medicament" SET "categorie" = 'COMPLEMENT_ALIMENTAIRE' WHERE "categorie" = 'VITAMINES';

-- Le modèle Chaleur existe déjà dans le schéma Prisma, mais sa migration
-- manquait. IF NOT EXISTS préserve les bases où la table a déjà été créée.
CREATE TABLE IF NOT EXISTS "Chaleur" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animalId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chaleur_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

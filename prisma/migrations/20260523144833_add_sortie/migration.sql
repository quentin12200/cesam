-- CreateTable
CREATE TABLE "Sortie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animalId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "acheteur" TEXT,
    "prixKilo" REAL,
    "poids" REAL,
    "prixPrevuHT" REAL,
    "prixDefinitifHT" REAL,
    "dateDebutEngr" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sortie_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Sortie_animalId_key" ON "Sortie"("animalId");

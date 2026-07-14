CREATE TABLE "AlimentProduit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nom" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "AlimentProduit_nom_key" ON "AlimentProduit"("nom");

CREATE TABLE "TarifAliment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "produitId" TEXT NOT NULL,
  "dateSaisie" DATETIME NOT NULL,
  "modeVente" TEXT NOT NULL,
  "prixPaye" REAL NOT NULL,
  "poidsKg" REAL NOT NULL,
  "prixKg" REAL NOT NULL,
  "fournisseur" TEXT,
  "marque" TEXT,
  "conditionnement" TEXT,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TarifAliment_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "AlimentProduit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TarifAliment_produitId_dateSaisie_idx" ON "TarifAliment"("produitId", "dateSaisie");

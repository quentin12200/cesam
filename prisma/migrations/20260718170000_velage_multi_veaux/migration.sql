ALTER TABLE "Velage" ADD COLUMN "nombreVeaux" INTEGER NOT NULL DEFAULT 1;
CREATE TABLE "VeauVelage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "velageId" TEXT NOT NULL,
  "animalId" TEXT,
  "nutrav" TEXT,
  "nom" TEXT,
  "sexe" TEXT,
  "statut" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VeauVelage_velageId_fkey" FOREIGN KEY ("velageId") REFERENCES "Velage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VeauVelage_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VeauVelage_animalId_key" ON "VeauVelage"("animalId");
CREATE INDEX "VeauVelage_velageId_idx" ON "VeauVelage"("velageId");

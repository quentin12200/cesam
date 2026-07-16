CREATE TABLE "MedicamentAliasVocal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "alias" TEXT NOT NULL,
  "transcription" TEXT NOT NULL,
  "medicamentId" TEXT NOT NULL,
  "confirmations" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MedicamentAliasVocal_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "Medicament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MedicamentAliasVocal_alias_key" ON "MedicamentAliasVocal"("alias");
CREATE INDEX "MedicamentAliasVocal_medicamentId_idx" ON "MedicamentAliasVocal"("medicamentId");

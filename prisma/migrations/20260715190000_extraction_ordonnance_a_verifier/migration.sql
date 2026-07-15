CREATE TABLE "ExtractionOrdonnance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statut" TEXT NOT NULL DEFAULT 'A_VERIFIER',
    "documentUrl" TEXT NOT NULL,
    "reponseBrute" TEXT NOT NULL,
    "propositionInitiale" TEXT NOT NULL,
    "valeursCorrigees" TEXT,
    "corrections" TEXT,
    "resultatFinal" TEXT,
    "modele" TEXT NOT NULL,
    "versionPrompt" TEXT NOT NULL,
    "analyseLe" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valideeLe" DATETIME,
    "ordonnanceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExtractionOrdonnance_ordonnanceId_fkey" FOREIGN KEY ("ordonnanceId") REFERENCES "Ordonnance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExtractionOrdonnance_ordonnanceId_key" ON "ExtractionOrdonnance"("ordonnanceId");
CREATE INDEX "ExtractionOrdonnance_statut_analyseLe_idx" ON "ExtractionOrdonnance"("statut", "analyseLe");

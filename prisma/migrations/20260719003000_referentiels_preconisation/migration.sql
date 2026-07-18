CREATE TABLE "ValeurReferentielPreconisation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "libelle" TEXT NOT NULL,
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ValeurReferentielPreconisation_type_code_key" ON "ValeurReferentielPreconisation"("type", "code");
CREATE INDEX "ValeurReferentielPreconisation_type_actif_idx" ON "ValeurReferentielPreconisation"("type", "actif");

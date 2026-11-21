-- SQLite : ajout nullable avec reference; les anciennes lignes restent a NULL.
ALTER TABLE "Vaccination" ADD COLUMN "evenementId" TEXT REFERENCES "EvenementSanitaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Vaccination_evenementId_idx" ON "Vaccination"("evenementId");

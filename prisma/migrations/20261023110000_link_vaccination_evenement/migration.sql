-- Association facultative des vaccinations a leur evenement sanitaire source.
-- Aucune donnee historique n'est deduite ou reattribuee automatiquement.
ALTER TABLE "Vaccination" ADD COLUMN "evenementId" TEXT;
CREATE INDEX "Vaccination_evenementId_idx" ON "Vaccination"("evenementId");
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "EvenementSanitaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

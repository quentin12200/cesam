ALTER TABLE "Parage" ADD COLUMN "evenementId" TEXT REFERENCES "EvenementSanitaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Parage" ADD COLUMN "motif" TEXT NOT NULL DEFAULT 'PARAGE';
ALTER TABLE "Parage" ADD COLUMN "statut" TEXT NOT NULL DEFAULT 'A_VOIR';
ALTER TABLE "Parage" ADD COLUMN "dateFait" DATETIME;

CREATE UNIQUE INDEX "Parage_evenementId_key" ON "Parage"("evenementId");
CREATE INDEX "Parage_statut_date_idx" ON "Parage"("statut", "date");

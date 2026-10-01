ALTER TABLE "Traitement" ADD COLUMN "protocoleVaccinId" TEXT REFERENCES "ProtocoleVaccin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Traitement" ADD COLUMN "etapeProtocoleVaccinId" TEXT REFERENCES "EtapeProtocoleVaccin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Traitement" ADD COLUMN "gestationId" TEXT REFERENCES "Gestation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Traitement_protocoleVaccinId_idx" ON "Traitement"("protocoleVaccinId");
CREATE INDEX "Traitement_etapeProtocoleVaccinId_idx" ON "Traitement"("etapeProtocoleVaccinId");
CREATE INDEX "Traitement_gestationId_idx" ON "Traitement"("gestationId");

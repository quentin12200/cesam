-- B3: milk withdrawal period on medication
ALTER TABLE "Medicament" ADD COLUMN "delaiAttenteLaitJ" INTEGER;

-- B4: administration route and annual recall on vaccination protocols
ALTER TABLE "ProtocoleVaccin" ADD COLUMN "voiePrimo" TEXT NOT NULL DEFAULT 'IM';
ALTER TABLE "ProtocoleVaccin" ADD COLUMN "voieRappel" TEXT NOT NULL DEFAULT 'IM';
ALTER TABLE "ProtocoleVaccin" ADD COLUMN "rappelAnnuel" INTEGER NOT NULL DEFAULT 0;

-- Additive only: existing protocols remain legacy while this value is NULL.
ALTER TABLE "ProtocoleVaccin" ADD COLUMN "configurationQuestionnaireJson" TEXT;

-- Stable snapshot of the branch selected when the initial Primo was performed.
ALTER TABLE "StatutProtocoleVaccinal" ADD COLUMN "brancheInitialeId" TEXT;

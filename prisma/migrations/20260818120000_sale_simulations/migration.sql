CREATE TABLE "SaleSimulation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weighingSessionId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'DRAFT',
    "refactionGlobale" REAL NOT NULL DEFAULT 0,
    "prixKgGlobal" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SaleSimulation_weighingSessionId_fkey" FOREIGN KEY ("weighingSessionId") REFERENCES "WeighingSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SaleSimulationAnimal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "simulationId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "dernierePeseePoids" REAL,
    "dernierePeseeDate" DATETIME,
    "gmqUtilise" REAL,
    "poidsPredit" REAL,
    "poidsMarchand" REAL,
    "poidsManuel" REAL,
    "sourcePoids" TEXT NOT NULL,
    "poidsUtilise" REAL NOT NULL,
    "refactionIndividuelle" REAL,
    "prixKgIndividuel" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SaleSimulationAnimal_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "SaleSimulation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleSimulationAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "SaleSimulation_weighingSessionId_idx" ON "SaleSimulation"("weighingSessionId");
CREATE INDEX "SaleSimulation_statut_updatedAt_idx" ON "SaleSimulation"("statut", "updatedAt");
CREATE UNIQUE INDEX "SaleSimulationAnimal_simulationId_animalId_key" ON "SaleSimulationAnimal"("simulationId", "animalId");
CREATE INDEX "SaleSimulationAnimal_animalId_idx" ON "SaleSimulationAnimal"("animalId");

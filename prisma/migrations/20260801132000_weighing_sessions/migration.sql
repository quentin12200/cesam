-- CESAM est mono-exploitation par base : une seule séance peut être active.
CREATE TABLE "WeighingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "selectionData" JSONB,
    "simulationData" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeighingSession_status_check"
      CHECK ("status" IN ('ACTIVE', 'FINISHED', 'ABANDONED')),
    CONSTRAINT "WeighingSession_end_check"
      CHECK (
        ("status" = 'ACTIVE' AND "endedAt" IS NULL)
        OR
        ("status" IN ('FINISHED', 'ABANDONED') AND "endedAt" IS NOT NULL)
      )
);

ALTER TABLE "Pesee" ADD COLUMN "weighingSessionId" TEXT
  REFERENCES "WeighingSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Pesee_weighingSessionId_idx"
  ON "Pesee"("weighingSessionId");

CREATE UNIQUE INDEX "Pesee_weighingSessionId_animalId_key"
  ON "Pesee"("weighingSessionId", "animalId");

CREATE INDEX "WeighingSession_startedAt_idx"
  ON "WeighingSession"("startedAt");

CREATE INDEX "WeighingSession_status_startedAt_idx"
  ON "WeighingSession"("status", "startedAt");

CREATE UNIQUE INDEX "WeighingSession_single_active_key"
  ON "WeighingSession"("status")
  WHERE "status" = 'ACTIVE';

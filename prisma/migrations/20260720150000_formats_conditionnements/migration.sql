PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ConditionnementMedicament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medicamentId" TEXT NOT NULL,
    "quantiteFlacon" REAL,
    "uniteFlacon" TEXT,
    "doses" REAL NOT NULL DEFAULT 0,
    "prixFlaconEur" REAL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConditionnementMedicament_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "Medicament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ConditionnementMedicament" ("id", "medicamentId", "doses", "prixFlaconEur", "actif", "createdAt")
SELECT "id", "medicamentId", "doses", "prixFlaconEur", "actif", "createdAt"
FROM "ConditionnementMedicament";

DROP TABLE "ConditionnementMedicament";
ALTER TABLE "new_ConditionnementMedicament" RENAME TO "ConditionnementMedicament";
CREATE INDEX "ConditionnementMedicament_medicamentId_idx" ON "ConditionnementMedicament"("medicamentId");

PRAGMA foreign_keys=ON;

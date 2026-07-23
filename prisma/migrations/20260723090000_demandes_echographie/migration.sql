CREATE TABLE "DemandeEchographie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animalId" TEXT NOT NULL,
    "saillieId" TEXT,
    "origine" TEXT NOT NULL,
    "etat" TEXT NOT NULL DEFAULT 'A_FAIRE',
    "motif" TEXT,
    "requestKey" TEXT,
    "clotureeAt" DATETIME,
    "auteurAjout" TEXT,
    "auteurRetrait" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DemandeEchographie_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DemandeEchographie_saillieId_fkey" FOREIGN KEY ("saillieId") REFERENCES "Saillie" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DemandeEchographie_requestKey_key" ON "DemandeEchographie"("requestKey");
CREATE INDEX "DemandeEchographie_animalId_etat_idx" ON "DemandeEchographie"("animalId", "etat");
CREATE INDEX "DemandeEchographie_saillieId_etat_idx" ON "DemandeEchographie"("saillieId", "etat");

INSERT INTO "DemandeEchographie" (
    "id", "animalId", "saillieId", "origine", "etat", "motif", "requestKey", "createdAt", "updatedAt"
)
SELECT
    'legacy-echo-' || a."id",
    a."id",
    (
      SELECT s."id"
      FROM "Saillie" s
      WHERE s."animalId" = a."id"
      ORDER BY s."date" DESC, s."createdAt" DESC
      LIMIT 1
    ),
    'MANUELLE',
    'A_FAIRE',
    'AUTRE',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Animal" a
WHERE a."aEchographier" = 1 OR a."reproductionEtatManuel" = 'JAUNE';

UPDATE "Animal"
SET "aEchographier" = 1,
    "reproductionEtatManuel" = NULL,
    "reproductionEtatModifieAt" = CURRENT_TIMESTAMP
WHERE "reproductionEtatManuel" = 'JAUNE';

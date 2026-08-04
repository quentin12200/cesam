CREATE TABLE IF NOT EXISTS "OrdonnanceMedicament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordonnanceId" TEXT NOT NULL,
    "medicamentId" TEXT NOT NULL,
    "nomExtrait" TEXT NOT NULL,
    "numeroLot" TEXT,
    "substanceActive" TEXT,
    "concentration" TEXT,
    "categorieExtraite" TEXT,
    "familleTherapeutique" TEXT,
    "formePharmaceutique" TEXT,
    "conditionnement" TEXT,
    "posologieExtraite" TEXT,
    "dose" REAL,
    "uniteDosage" TEXT,
    "referenceValue" REAL,
    "referenceUnit" TEXT,
    "referenceType" TEXT,
    "normalizedDoseValue" REAL,
    "normalizedDoseUnit" TEXT,
    "voieExtraite" TEXT,
    "dureeExtraite" INTEGER,
    "administrationCount" INTEGER,
    "administrationIntervalHours" INTEGER,
    "repeatCondition" TEXT,
    "administrationInstructions" TEXT,
    "delaiAttenteViande" INTEGER,
    "delaiAttenteAbats" INTEGER,
    "delaiAttenteLait" INTEGER,
    "precautions" TEXT,
    "texteSource" TEXT,
    "evidenceJson" TEXT,
    "candidatsJson" TEXT,
    "scoreCorrespondance" REAL,
    "statutCorrespondance" TEXT NOT NULL DEFAULT 'unmatched',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrdonnanceMedicament_ordonnanceId_fkey"
      FOREIGN KEY ("ordonnanceId") REFERENCES "Ordonnance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrdonnanceMedicament_medicamentId_fkey"
      FOREIGN KEY ("medicamentId") REFERENCES "Medicament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrdonnanceMedicament_ordonnanceId_idx" ON "OrdonnanceMedicament"("ordonnanceId");
CREATE INDEX IF NOT EXISTS "OrdonnanceMedicament_medicamentId_idx" ON "OrdonnanceMedicament"("medicamentId");
CREATE INDEX IF NOT EXISTS "OrdonnanceMedicament_statutCorrespondance_idx" ON "OrdonnanceMedicament"("statutCorrespondance");

-- Compatibilité : chaque lien direct historique devient une liaison explicite.
-- Les colonnes de Ordonnance sont conservées pour les anciens écrans et parcours.
INSERT OR IGNORE INTO "OrdonnanceMedicament" (
    "id", "ordonnanceId", "medicamentId", "nomExtrait", "substanceActive",
    "concentration", "categorieExtraite", "familleTherapeutique",
    "formePharmaceutique", "conditionnement", "posologieExtraite", "dose",
    "uniteDosage", "referenceValue", "referenceUnit", "referenceType",
    "normalizedDoseValue", "normalizedDoseUnit", "voieExtraite", "dureeExtraite",
    "administrationCount", "administrationIntervalHours", "repeatCondition",
    "administrationInstructions", "delaiAttenteViande", "delaiAttenteAbats",
    "delaiAttenteLait", "precautions", "evidenceJson", "scoreCorrespondance",
    "statutCorrespondance", "createdAt", "updatedAt"
)
SELECT
    'legacy-' || "id", "id", "medicamentId", COALESCE(NULLIF("medicamentNom", ''), 'Médicament'),
    "substanceActive", "concentration", "categorieMedicament", "familleTherapeutique",
    "formePharmaceutique", "conditionnement",
    CASE WHEN "dose" IS NULL THEN NULL
      ELSE CAST("dose" AS TEXT) || COALESCE(' ' || "uniteDosage", '')
        || CASE WHEN "referenceValue" IS NULL THEN ''
          ELSE ' / ' || CAST("referenceValue" AS TEXT) || COALESCE(' ' || "referenceUnit", '') END
    END,
    "dose", "uniteDosage", "referenceValue", "referenceUnit", "referenceType",
    "normalizedDoseValue", "normalizedDoseUnit", "voie", "dureeJours",
    "administrationCount", "administrationIntervalHours", "repeatCondition",
    "administrationInstructions", "delaiAttenteViandeJ", "delaiAttenteAbatsJ",
    "delaiAttenteLaitJ", "precautions", "extractionStructuree", 1.0,
    'manually_confirmed', "createdAt", "updatedAt"
FROM "Ordonnance"
WHERE "medicamentId" IS NOT NULL;

ALTER TABLE "Sortie" ADD COLUMN "categorieSortie" TEXT;
ALTER TABLE "Sortie" ADD COLUMN "sexeSortie" TEXT;
ALTER TABLE "Sortie" ADD COLUMN "modeVente" TEXT;
ALTER TABLE "Sortie" ADD COLUMN "poidsVifVente" REAL;
ALTER TABLE "Sortie" ADD COLUMN "prixKgVif" REAL;
ALTER TABLE "Sortie" ADD COLUMN "poidsCarcasse" REAL;
ALTER TABLE "Sortie" ADD COLUMN "prixKgCarcasse" REAL;

UPDATE "Sortie"
SET
  "sexeSortie" = (SELECT "sexbov" FROM "Animal" WHERE "Animal"."id" = "Sortie"."animalId"),
  "categorieSortie" = (
    SELECT CASE
      WHEN UPPER(COALESCE("categorie", '')) LIKE '%GENISSE%' THEN 'GENISSE'
      WHEN UPPER(COALESCE("categorie", '')) LIKE '%VELLE%'
        OR UPPER(COALESCE("categorie", '')) LIKE '%VEAU%' THEN 'VEAU'
      WHEN UPPER(COALESCE("categorie", '')) LIKE '%TAUREAU%' THEN 'TAUREAU'
      WHEN UPPER(COALESCE("categorie", '')) LIKE '%VACHE%' THEN 'VACHE'
      WHEN "sexbov" = 'F' THEN 'VACHE'
      ELSE 'VEAU'
    END
    FROM "Animal" WHERE "Animal"."id" = "Sortie"."animalId"
  ),
  "modeVente" = CASE
    WHEN "type" = 'ELEVAGE' THEN 'VIF'
    WHEN "type" = 'BOUCHERIE' THEN 'CARCASSE'
    ELSE NULL
  END,
  "poidsVifVente" = CASE WHEN "type" = 'ELEVAGE' THEN "poids" ELSE NULL END,
  "prixKgVif" = CASE WHEN "type" = 'ELEVAGE' THEN "prixKilo" ELSE NULL END,
  "poidsCarcasse" = CASE WHEN "type" = 'BOUCHERIE' THEN "poids" ELSE NULL END,
  "prixKgCarcasse" = CASE WHEN "type" = 'BOUCHERIE' THEN "prixKilo" ELSE NULL END;


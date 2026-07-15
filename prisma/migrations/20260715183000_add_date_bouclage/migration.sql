ALTER TABLE "Animal" ADD COLUMN "dateBouclage" DATETIME;

UPDATE "Animal"
SET "dateBouclage" = "updatedAt"
WHERE "boucleFaite" = 1 AND "dateBouclage" IS NULL;

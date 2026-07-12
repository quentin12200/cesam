-- AlterTable
ALTER TABLE "Ordonnance" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "Traitement" ADD COLUMN "ordonnanceId" TEXT;
ALTER TABLE "Vaccination" ADD COLUMN "ordonnanceId" TEXT;

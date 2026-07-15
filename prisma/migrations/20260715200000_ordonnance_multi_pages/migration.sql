-- Multi-pages : plusieurs photos/pages pour une même ordonnance.
ALTER TABLE "Ordonnance" ADD COLUMN "photoUrls" TEXT;
ALTER TABLE "ExtractionOrdonnance" ADD COLUMN "documentUrls" TEXT;

-- Création et gestion d'un événement sanitaire avec traitement optionnel :
-- le traitement devient une option intégrée au même formulaire (exécutant,
-- moment de la journée), avec une liste mémorisée d'intervenants.

ALTER TABLE "Traitement" ADD COLUMN "executant" TEXT;
ALTER TABLE "Traitement" ADD COLUMN "moment" TEXT;

CREATE TABLE "Intervenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Intervenant_nom_key" ON "Intervenant"("nom");

INSERT INTO "Intervenant" ("id", "nom", "createdAt") VALUES
    ('intervenant_celine', 'Céline', CURRENT_TIMESTAMP),
    ('intervenant_samuel', 'Samuel', CURRENT_TIMESTAMP);

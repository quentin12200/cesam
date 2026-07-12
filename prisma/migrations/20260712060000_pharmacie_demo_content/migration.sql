-- Contenu de démonstration pour "Actions" et "En savoir +" : un médicament par
-- grande catégorie, pour valider la structure du répertoire avant de remplir
-- automatiquement le reste de la base (118 médicaments).

UPDATE "Medicament" SET "actions" = 'Infection respiratoire,Infection bactérienne' WHERE "nom" = 'DRAXXIN';
UPDATE "Medicament" SET "actions" = 'Douleur,Inflammation,Fièvre' WHERE "nom" = 'METACAM';
UPDATE "Medicament" SET "actions" = 'Vers,Poux,Gale' WHERE "nom" = 'IVOMEC';
UPDATE "Medicament" SET "actions" = 'Fatigue,Récupération,Croissance' WHERE "nom" = 'CATOSAL';
UPDATE "Medicament" SET "actions" = 'Inflammation,Choc,Allergie' WHERE "nom" = 'DEXAFORT';

INSERT INTO "MedicamentTerme" ("id", "medicamentId", "terme", "explication", "ordre", "createdAt", "updatedAt")
SELECT 'terme_draxxin_1', "id", 'Antibiotique', 'Substance qui combat une infection causée par des bactéries.', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Medicament" WHERE "nom" = 'DRAXXIN';
INSERT INTO "MedicamentTerme" ("id", "medicamentId", "terme", "explication", "ordre", "createdAt", "updatedAt")
SELECT 'terme_draxxin_2', "id", 'Longue action', 'Une seule injection suffit pour plusieurs jours de traitement.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Medicament" WHERE "nom" = 'DRAXXIN';

INSERT INTO "MedicamentTerme" ("id", "medicamentId", "terme", "explication", "ordre", "createdAt", "updatedAt")
SELECT 'terme_metacam_1', "id", 'Antalgique', 'Agit contre la douleur.', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Medicament" WHERE "nom" = 'METACAM';
INSERT INTO "MedicamentTerme" ("id", "medicamentId", "terme", "explication", "ordre", "createdAt", "updatedAt")
SELECT 'terme_metacam_2', "id", 'Antipyrétique', 'Aide à faire baisser la fièvre.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Medicament" WHERE "nom" = 'METACAM';
INSERT INTO "MedicamentTerme" ("id", "medicamentId", "terme", "explication", "ordre", "createdAt", "updatedAt")
SELECT 'terme_metacam_3', "id", 'Anti-exsudatif', 'Limite certains gonflements liés à l''inflammation.', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Medicament" WHERE "nom" = 'METACAM';

INSERT INTO "MedicamentTerme" ("id", "medicamentId", "terme", "explication", "ordre", "createdAt", "updatedAt")
SELECT 'terme_ivomec_1', "id", 'Endectocide', 'Traite à la fois les parasites internes (vers) et externes (poux, gale).', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Medicament" WHERE "nom" = 'IVOMEC';
INSERT INTO "MedicamentTerme" ("id", "medicamentId", "terme", "explication", "ordre", "createdAt", "updatedAt")
SELECT 'terme_ivomec_2', "id", 'Antiparasitaire', 'Élimine les parasites présents chez l''animal.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Medicament" WHERE "nom" = 'IVOMEC';

INSERT INTO "MedicamentTerme" ("id", "medicamentId", "terme", "explication", "ordre", "createdAt", "updatedAt")
SELECT 'terme_catosal_1', "id", 'Fortifiant', 'Aide l''organisme à récupérer après un effort ou une maladie.', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Medicament" WHERE "nom" = 'CATOSAL';
INSERT INTO "MedicamentTerme" ("id", "medicamentId", "terme", "explication", "ordre", "createdAt", "updatedAt")
SELECT 'terme_catosal_2', "id", 'Phosphore organique', 'Apporte de l''énergie utilisable par les cellules.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Medicament" WHERE "nom" = 'CATOSAL';

INSERT INTO "MedicamentTerme" ("id", "medicamentId", "terme", "explication", "ordre", "createdAt", "updatedAt")
SELECT 'terme_dexafort_1', "id", 'Corticoïde', 'Puissant anti-inflammatoire d''action rapide.', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Medicament" WHERE "nom" = 'DEXAFORT';
INSERT INTO "MedicamentTerme" ("id", "medicamentId", "terme", "explication", "ordre", "createdAt", "updatedAt")
SELECT 'terme_dexafort_2', "id", 'Effet retard', 'L''action se prolonge plusieurs jours après l''injection.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Medicament" WHERE "nom" = 'DEXAFORT';

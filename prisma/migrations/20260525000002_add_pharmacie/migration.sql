CREATE TABLE "Medicament" (
    "id"                  TEXT NOT NULL PRIMARY KEY,
    "nom"                 TEXT NOT NULL,
    "dci"                 TEXT,
    "categorie"           TEXT NOT NULL DEFAULT 'AUTRE',
    "voie"                TEXT,
    "dosagePourKg"        REAL,
    "uniteDosage"         TEXT DEFAULT 'ml',
    "delaiAttenteViandeJ" INTEGER,
    "prescriptionRequise" INTEGER NOT NULL DEFAULT 0,
    "actif"               INTEGER NOT NULL DEFAULT 1,
    "createdAt"           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Medicament_nom_key" ON "Medicament"("nom");

CREATE TABLE "Traitement" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "animalId"      TEXT NOT NULL,
    "medicamentId"  TEXT,
    "medicamentNom" TEXT NOT NULL,
    "dateDebut"     DATETIME NOT NULL,
    "dureeJours"    INTEGER NOT NULL DEFAULT 1,
    "voie"          TEXT,
    "dose"          REAL,
    "uniteDosage"   TEXT,
    "motif"         TEXT,
    "veterinaire"   TEXT,
    "statut"        TEXT NOT NULL DEFAULT 'EN_COURS',
    "notes"         TEXT,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Traitement_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Traitement_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "Medicament"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Seed: bibliothèque de médicaments courants (bovins)
INSERT INTO "Medicament" ("id","nom","dci","categorie","voie","dosagePourKg","uniteDosage","delaiAttenteViandeJ","prescriptionRequise","actif","createdAt","updatedAt") VALUES
  ('med_1', 'METACAM','Méloxicam','ANTIDOULEUR','IM/SC',0.5,'ml',15,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_2', 'DRAXXIN','Tulathromycine','ANTIBIOTIQUE','SC',2.5,'ml',18,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_3', 'ZACTRAN','Gamithromycine','ANTIBIOTIQUE','SC',6.0,'ml',65,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_4', 'BAYTRIL','Enrofloxacine','ANTIBIOTIQUE','SC/IM',5.0,'ml',14,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_5', 'FINADYNE','Flunixine de méglumine','ANTIDOULEUR','IV/IM',2.2,'ml',4,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_6', 'AMOXICILLINE','Amoxicilline trihydrate','ANTIBIOTIQUE','IM',7.0,'ml',60,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_7', 'DEPOCILLINE','Pénicilline procaïne','ANTIBIOTIQUE','IM',10.0,'ml',28,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_8', 'DECTOMAX','Doramectine','ANTIPARASITAIRE','SC',0.2,'ml',70,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_9', 'IVOMEC','Ivermectine','ANTIPARASITAIRE','SC',0.2,'ml',28,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_10','PANACUR','Fenbendazole','ANTIPARASITAIRE','PO',NULL,'g',4,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_11','ALBA','Albendazole','ANTIPARASITAIRE','PO',NULL,'comprimé',14,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_12','DEXAFORT','Dexaméthasone','CORTICOIDE','IM',NULL,'ml',8,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_13','CATOSAL','Butaphosphan + Cyanocobalamine','VITAMINES','IM/SC',NULL,'ml',0,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_14','OXYTÉTRACYCLINE','Oxytétracycline','ANTIBIOTIQUE','IM',20.0,'ml',28,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('med_15','DUPHATRIM','Triméthoprime + Sulfadiazine','ANTIBIOTIQUE','PO',NULL,'ml',14,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

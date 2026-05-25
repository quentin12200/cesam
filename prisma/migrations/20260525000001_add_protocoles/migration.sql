CREATE TABLE "ProtocoleVaccin" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "nom"                TEXT NOT NULL,
    "label"              TEXT NOT NULL,
    "ordre"              INTEGER NOT NULL DEFAULT 0,
    "ageMinJours"        INTEGER NOT NULL DEFAULT 0,
    "urgenceJours"       INTEGER,
    "estRappel"          INTEGER NOT NULL DEFAULT 0,
    "primoNom"           TEXT,
    "delaiRappelJours"   INTEGER,
    "urgenceRappelJours" INTEGER,
    "obligatoireVente"   INTEGER NOT NULL DEFAULT 0,
    "actif"              INTEGER NOT NULL DEFAULT 1,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ProtocoleVaccin_nom_key" ON "ProtocoleVaccin"("nom");

INSERT INTO "ProtocoleVaccin" ("id","nom","label","ordre","ageMinJours","urgenceJours","estRappel","primoNom","delaiRappelJours","urgenceRappelJours","obligatoireVente","actif","createdAt","updatedAt") VALUES
  ('proto_1','NASALGEN','Nasalgen',1,0,7,0,NULL,NULL,NULL,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('proto_2','NASALGEN_RAPPEL','Nasalgen rappel',2,0,NULL,1,'NASALGEN',90,105,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('proto_3','HIPRABOVIS','Hiprabovis',3,30,60,0,NULL,NULL,NULL,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('proto_4','HIPRABOVIS_RAPPEL','Hiprabovis rappel',4,0,NULL,1,'HIPRABOVIS',21,35,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('proto_5','MHE','MHE primo',5,60,60,0,NULL,NULL,NULL,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('proto_6','MHE_RAPPEL','MHE rappel',6,0,NULL,1,'MHE',21,35,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

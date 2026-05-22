-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "copaip" TEXT NOT NULL DEFAULT 'FR',
    "nunati" TEXT NOT NULL,
    "nutrav" TEXT NOT NULL,
    "nobovi" TEXT,
    "danais" DATETIME NOT NULL,
    "sexbov" TEXT NOT NULL DEFAULT 'F',
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "race" TEXT NOT NULL DEFAULT 'BLONDE_AQUITAINE',
    "estGenisse" BOOLEAN NOT NULL DEFAULT false,
    "copami" TEXT,
    "numeip" TEXT,
    "nomeip" TEXT,
    "tramip" TEXT,
    "mereId" TEXT,
    "taureauId" TEXT,
    "boucleNumero" TEXT,
    "boucleFaite" BOOLEAN NOT NULL DEFAULT false,
    "localisationId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Animal_mereId_fkey" FOREIGN KEY ("mereId") REFERENCES "Animal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Animal_taureauId_fkey" FOREIGN KEY ("taureauId") REFERENCES "Taureau" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Animal_localisationId_fkey" FOREIGN KEY ("localisationId") REFERENCES "Localisation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Taureau" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "copaip" TEXT NOT NULL DEFAULT 'FR',
    "nupere" TEXT NOT NULL,
    "nopere" TEXT,
    "traper" TEXT,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Saillie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animalId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "estimation" BOOLEAN NOT NULL DEFAULT false,
    "groupage" BOOLEAN NOT NULL DEFAULT false,
    "tentative" INTEGER NOT NULL DEFAULT 1,
    "taureauId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Saillie_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Saillie_taureauId_fkey" FOREIGN KEY ("taureauId") REFERENCES "Taureau" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Gestation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saillieId" TEXT NOT NULL,
    "etat" TEXT NOT NULL DEFAULT 'GRIS',
    "dateEcho" DATETIME,
    "joursGestation" INTEGER,
    "dateVelagePrevue" DATETIME,
    "resultatEcho" TEXT,
    "sousResultat" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Gestation_saillieId_fkey" FOREIGN KEY ("saillieId") REFERENCES "Saillie" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Velage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "qualificatif" TEXT NOT NULL DEFAULT 'NORMAL',
    "sousType" TEXT,
    "vacheId" TEXT NOT NULL,
    "veauId" TEXT,
    "gestationId" TEXT,
    "capteur" INTEGER,
    "pereNom" TEXT,
    "pereNunati" TEXT,
    "jumeaux" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Velage_vacheId_fkey" FOREIGN KEY ("vacheId") REFERENCES "Animal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Velage_veauId_fkey" FOREIGN KEY ("veauId") REFERENCES "Animal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Velage_gestationId_fkey" FOREIGN KEY ("gestationId") REFERENCES "Gestation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animalId" TEXT NOT NULL,
    "vaccin" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "voie" TEXT,
    "dose" REAL,
    "statut" TEXT NOT NULL DEFAULT 'FAIT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vaccination_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvenementSanitaire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT,
    "photos" TEXT,
    "resolu" BOOLEAN NOT NULL DEFAULT false,
    "dateResolu" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvenementSanitaire_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pesee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animalId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "poids" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pesee_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Parage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animalId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "pattes" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Parage_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplementAlim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'PREVU',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ComplementAlim_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Localisation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CapteurVelage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" INTEGER NOT NULL,
    "animalNutrav" TEXT,
    "animalNom" TEXT,
    "dateAttribution" DATETIME,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Animal_nunati_key" ON "Animal"("nunati");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_nutrav_key" ON "Animal"("nutrav");

-- CreateIndex
CREATE UNIQUE INDEX "Taureau_nupere_key" ON "Taureau"("nupere");

-- CreateIndex
CREATE UNIQUE INDEX "Gestation_saillieId_key" ON "Gestation"("saillieId");

-- CreateIndex
CREATE UNIQUE INDEX "Velage_veauId_key" ON "Velage"("veauId");

-- CreateIndex
CREATE UNIQUE INDEX "Velage_gestationId_key" ON "Velage"("gestationId");

-- CreateIndex
CREATE UNIQUE INDEX "Localisation_nom_key" ON "Localisation"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "CapteurVelage_numero_key" ON "CapteurVelage"("numero");

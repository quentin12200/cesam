-- CreateTable
CREATE TABLE "NoteTerrain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "texte" TEXT NOT NULL,
    "traitee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

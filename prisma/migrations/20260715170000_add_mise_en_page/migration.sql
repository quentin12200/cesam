CREATE TABLE "MiseEnPage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "profil" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "sections" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "MiseEnPage_profil_module_key" ON "MiseEnPage"("profil", "module");

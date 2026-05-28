CREATE TABLE "ActionLog" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "type"        TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "revertData"  TEXT NOT NULL,
  "reverted"    BOOLEAN NOT NULL DEFAULT false,
  "revertedAt"  DATETIME,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

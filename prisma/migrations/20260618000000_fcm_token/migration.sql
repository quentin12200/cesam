CREATE TABLE IF NOT EXISTS "FcmToken" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "token"       TEXT NOT NULL UNIQUE,
    "device"      TEXT,
    "lastNotifAt" DATETIME,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL
);

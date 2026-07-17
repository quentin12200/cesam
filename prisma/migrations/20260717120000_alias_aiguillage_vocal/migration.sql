CREATE TABLE "VoiceRoutingAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phrase" TEXT NOT NULL,
    "phraseNormalisee" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "VoiceRoutingAlias_phraseNormalisee_key" ON "VoiceRoutingAlias"("phraseNormalisee");
CREATE INDEX "VoiceRoutingAlias_action_idx" ON "VoiceRoutingAlias"("action");

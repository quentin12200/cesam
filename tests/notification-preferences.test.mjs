import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  isValidSubscriptionCredentials,
  mergeNotificationPreferences,
  parseNotificationPreferences,
  selectDailyNotificationItems,
  validateNotificationPreferencePatch,
} from "../lib/notification-preferences.ts";

test("les préférences absentes ou invalides restent activées", () => {
  assert.deepEqual(parseNotificationPreferences("{}"), DEFAULT_NOTIFICATION_PREFERENCES);
  assert.deepEqual(parseNotificationPreferences("JSON invalide"), DEFAULT_NOTIFICATION_PREFERENCES);
  assert.equal(parseNotificationPreferences('{"heatReturn":false}').heatReturn, false);
  assert.equal(parseNotificationPreferences('{"heatReturn":false}').morningDigest, true);
});

test("seules les clés autorisées et booléennes sont acceptées", () => {
  assert.deepEqual(
    validateNotificationPreferencePatch({ heatReturn: false }),
    { valid: true, patch: { heatReturn: false } }
  );
  assert.equal(validateNotificationPreferencePatch({ inconnue: false }).valid, false);
  assert.equal(validateNotificationPreferencePatch({ heatReturn: "non" }).valid, false);
  assert.equal(validateNotificationPreferencePatch([]).valid, false);
});

test("une modification reste limitée à l’abonnement concerné", () => {
  const storedPreferences = JSON.stringify(
    mergeNotificationPreferences("{}", { fieldNotes: false })
  );
  const firstDevice = parseNotificationPreferences(storedPreferences);
  const secondDevice = parseNotificationPreferences("{}");
  assert.equal(firstDevice.fieldNotes, false);
  assert.equal(secondDevice.fieldNotes, true);
});

test("l’endpoint et sa clé locale sont tous deux nécessaires", () => {
  assert.equal(isValidSubscriptionCredentials({ endpoint: "https://push/device", auth: "secret" }), true);
  assert.equal(isValidSubscriptionCredentials({ endpoint: "https://push/device" }), false);
  assert.equal(isValidSubscriptionCredentials({ endpoint: "", auth: "secret" }), false);
});

test("le résumé peut être coupé sans couper les alertes de vêlage", () => {
  const groups = {
    general: ["Résumé général"],
    imminentCalving: ["Vêlage imminent"],
    reproductionDelay: ["Retard repro"],
    echoDue: [],
    healthTreatments: [],
    prescriptionsStocks: [],
  };
  const preferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    morningDigest: false,
    reproductionDelay: false,
  };
  assert.deepEqual(selectDailyNotificationItems(groups, preferences), ["Vêlage imminent"]);
});

test("la migration additive conserve les abonnements existants", async () => {
  const client = createClient({ url: "file::memory:" });
  await client.execute(`
    CREATE TABLE "PushSubscription" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "endpoint" TEXT NOT NULL UNIQUE,
      "p256dh" TEXT NOT NULL,
      "auth" TEXT NOT NULL,
      "device" TEXT,
      "lastNotifAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await client.execute({
    sql: `INSERT INTO "PushSubscription" ("id", "endpoint", "p256dh", "auth", "device", "updatedAt")
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    args: ["existing", "https://push/existing", "key", "auth", "Mobile"],
  });

  const migration = await readFile(
    new URL("../prisma/migrations/20260728120000_push_subscription_preferences/migration.sql", import.meta.url),
    "utf8"
  );
  await client.execute(migration);
  const result = await client.execute(
    `SELECT "id", "endpoint", "preferencesJson" FROM "PushSubscription" WHERE "id" = 'existing'`
  );

  assert.equal(result.rows[0].id, "existing");
  assert.equal(result.rows[0].endpoint, "https://push/existing");
  assert.equal(result.rows[0].preferencesJson, "{}");
  client.close();
});

test("le parcours configurable ne déclenche plus le double envoi FCM", async () => {
  const source = await readFile(
    new URL("../app/components/NotificationBell.tsx", import.meta.url),
    "utf8"
  );
  assert.equal(source.includes("/api/fcm/send"), false);
  assert.equal(source.includes("registerFcmToken"), false);
  assert.equal(source.includes("unregisterLocalFcmToken"), true);
});

test("les préférences heatReturn et fieldNotes filtrent leurs envois", async () => {
  const cron = await readFile(
    new URL("../app/api/cron/morning-digest/route.ts", import.meta.url),
    "utf8"
  );
  const fieldNotes = await readFile(
    new URL("../app/api/notes-terrain/route.ts", import.meta.url),
    "utf8"
  );
  assert.equal(cron.includes("if (preferences.heatReturn)"), true);
  assert.equal(fieldNotes.includes(".fieldNotes"), true);
});

test("la page distingue refus, incompatibilité, téléphone et ordinateur", async () => {
  const source = await readFile(
    new URL("../app/components/NotificationBell.tsx", import.meta.url),
    "utf8"
  );
  assert.equal(source.includes("Autorisation refusée"), true);
  assert.equal(source.includes("Appareil non compatible"), true);
  assert.equal(source.includes("Téléphone ou tablette"), true);
  assert.equal(source.includes("Ordinateur"), true);
});

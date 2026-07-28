import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  createWebPushPayload,
  heatReturnNotificationTag,
  morningDigestNotificationTag,
} from "../lib/web-push-payload.ts";

test("deux animaux et le résumé quotidien utilisent des tags distincts", () => {
  const first = heatReturnNotificationTag("animal-1", "heat-1");
  const second = heatReturnNotificationTag("animal-2", "heat-2");
  const digest = morningDigestNotificationTag(new Date("2026-07-28T06:00:00.000Z"));

  assert.equal(first, "retour-chaleur-animal-1-heat-1");
  assert.equal(second, "retour-chaleur-animal-2-heat-2");
  assert.equal(digest, "cesam-morning-digest-2026-07-28");
  assert.equal(new Set([first, second, digest]).size, 3);
});

test("une relance pour la même chaleur conserve le même tag et le bon lien", () => {
  const tag = heatReturnNotificationTag("animal-1", "heat-1");
  const firstPayload = createWebPushPayload({
    title: "Retour en chaleur à surveiller",
    body: "Vérifier 0000 — TEST.",
    url: "/troupeau/0000",
    tag,
  });
  const retryPayload = createWebPushPayload({
    title: "Retour en chaleur à surveiller",
    body: "Vérifier 0000 — TEST.",
    url: "/troupeau/0000",
    tag: heatReturnNotificationTag("animal-1", "heat-1"),
  });

  assert.deepEqual(JSON.parse(retryPayload), JSON.parse(firstPayload));
  assert.equal(JSON.parse(firstPayload).url, "/troupeau/0000");
});

test("le service worker respecte le tag Web Push et conserve le tag de repli", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const listeners = new Map();
  const notifications = [];
  const context = {
    importScripts() {},
    firebase: {
      initializeApp() {},
      messaging: () => ({ onBackgroundMessage() {} }),
    },
    self: {
      skipWaiting() {},
      clients: { claim() {} },
      registration: {
        showNotification: async (title, options) => notifications.push({ title, options }),
      },
      addEventListener: (name, handler) => listeners.set(name, handler),
    },
    clients: {
      matchAll: async () => [],
      openWindow: async () => null,
    },
  };
  vm.runInNewContext(source, context);

  const triggerPush = async (payload) => {
    let pending;
    listeners.get("push")({
      data: { json: () => payload },
      waitUntil: (promise) => { pending = promise; },
    });
    await pending;
  };

  await triggerPush({ title: "J18", url: "/troupeau/0000", tag: "retour-chaleur-animal-1-heat-1" });
  await triggerPush({ title: "Résumé", url: "/" });

  assert.equal(notifications[0].options.tag, "retour-chaleur-animal-1-heat-1");
  assert.equal(notifications[0].options.data.url, "/troupeau/0000");
  assert.equal(notifications[1].options.tag, "cesam-push");
});

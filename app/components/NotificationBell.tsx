"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

const VAPID_PUBLIC =
  "BGbFDTetWUjOx990WK2GcfPPQPveTizSLHn6jxIp_vul9f1hEeHmxTLbo4x_UzIhSRyj7Wao-KAssU2Q1fWSjKQ";

const FCM_VAPID_KEY =
  "BJ0fbIVNSum_e6VpxswRTcD2xvQpAqQfGGV5RtAsXREQi4SUSoaX4iQN4_m5Cw1IAxBbbwDys6_PY0P8qsBqUFU";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerFcmToken(sw: ServiceWorkerRegistration) {
  try {
    const { getFirebaseMessaging } = await import("@/lib/firebase-client");
    const { getToken } = await import("firebase/messaging");
    const messaging = await getFirebaseMessaging();
    if (!messaging) return;
    const token = await getToken(messaging, { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: sw });
    if (token) {
      await fetch("/api/fcm/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, device: navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop" }),
      });
    }
  } catch (err) {
    console.warn("FCM token registration failed:", err);
  }
}

async function unregisterFcmToken() {
  try {
    const { getFirebaseMessaging } = await import("@/lib/firebase-client");
    const { getToken, deleteToken } = await import("firebase/messaging");
    const messaging = await getFirebaseMessaging();
    if (!messaging) return;
    const sw = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: sw }).catch(() => null);
    if (token) {
      await deleteToken(messaging);
      await fetch("/api/fcm/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    }
  } catch (err) {
    console.warn("FCM token unregistration failed:", err);
  }
}

export default function NotificationBell() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);

    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(!!existing);
      if (existing) {
        fetch("/api/push/send", { method: "POST" }).catch(() => null);
        fetch("/api/fcm/send", { method: "POST" }).catch(() => null);
      }
    });
  }, []);

  async function toggleSubscription() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;

      if (subscribed) {
        // Unsubscribe VAPID
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
        // Unsubscribe FCM
        await unregisterFcmToken();
        setSubscribed(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          alert("Autorisez les notifications dans les paramètres du navigateur.");
          return;
        }

        // Register Firebase service worker
        await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
        const swReg = await navigator.serviceWorker.ready;

        // Subscribe VAPID (legacy web push)
        const sub = await swReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        });
        const json = sub.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
            device: navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop",
          }),
        });

        // Register FCM token
        await registerFcmToken(swReg);

        setSubscribed(true);
        await fetch("/api/push/send", { method: "POST" });
        await fetch("/api/fcm/send", { method: "POST" });
      }
    } catch (err) {
      console.error("Notification toggle error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      onClick={toggleSubscription}
      disabled={loading}
      title={subscribed ? "Désactiver les notifications" : "Activer les notifications push"}
      className={`p-1.5 rounded-lg transition-colors ${
        subscribed
          ? "bg-green-600 text-white hover:bg-green-500"
          : "bg-green-800 text-green-300 hover:bg-green-600 hover:text-white"
      } disabled:opacity-50`}
    >
      {subscribed ? <Bell size={18} /> : <BellOff size={18} />}
    </button>
  );
}

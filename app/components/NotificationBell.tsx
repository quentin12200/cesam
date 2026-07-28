"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Loader2, MonitorSmartphone, ShieldX } from "lucide-react";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "@/lib/notification-preferences";

const VAPID_PUBLIC =
  "BGbFDTetWUjOx990WK2GcfPPQPveTizSLHn6jxIp_vul9f1hEeHmxTLbo4x_UzIhSRyj7Wao-KAssU2Q1fWSjKQ";
const FCM_VAPID_KEY =
  "BJ0fbIVNSum_e6VpxswRTcD2xvQpAqQfGGV5RtAsXREQi4SUSoaX4iQN4_m5Cw1IAxBbbwDys6_PY0P8qsBqUFU";

type DeviceStatus = "loading" | "active" | "inactive" | "denied" | "unsupported";

interface SubscriptionDetails {
  device: string | null;
  createdAt: string | null;
  lastNotifAt: string | null;
}

const PREFERENCE_LABELS: Array<{
  key: NotificationPreferenceKey;
  title: string;
  description: string;
}> = [
  { key: "morningDigest", title: "Résumé du matin", description: "Le point général quotidien sur le troupeau." },
  { key: "imminentCalving", title: "Vêlages imminents", description: "Les vêlages proches et la surveillance associée." },
  { key: "reproductionDelay", title: "Retards de reproduction", description: "Les femelles dont la reproduction demande une attention." },
  { key: "echoDue", title: "Échographies à faire", description: "Les diagnostics de gestation arrivés à échéance." },
  { key: "heatReturn", title: "Retour en chaleur", description: "Le rappel au début de la fenêtre de surveillance." },
  { key: "healthTreatments", title: "Santé et traitements", description: "Les soins, vaccinations et traitements à surveiller." },
  { key: "prescriptionsStocks", title: "Ordonnances et stocks", description: "Les ordonnances à associer et les stocks bas." },
  { key: "fieldNotes", title: "Notes terrain", description: "Les nouvelles notes dictées dans CESAM." },
];

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

function subscriptionCredentials(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    auth: json.keys?.auth ?? "",
    p256dh: json.keys?.p256dh ?? "",
  };
}

function currentDeviceLabel() {
  return /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? "Téléphone ou tablette"
    : "Ordinateur";
}

function displayDeviceLabel(value: string | null | undefined) {
  if (!value) return currentDeviceLabel();
  if (value === "Mobile") return "Téléphone ou tablette";
  if (value === "Desktop") return "Ordinateur";
  return value;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

async function unregisterLocalFcmToken(registration: ServiceWorkerRegistration) {
  try {
    const { getFirebaseMessaging } = await import("@/lib/firebase-client");
    const { getToken, deleteToken } = await import("firebase/messaging");
    const messaging = await getFirebaseMessaging();
    if (!messaging) return;
    const token = await getToken(messaging, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: registration,
    }).catch(() => null);
    if (!token) return;
    await deleteToken(messaging);
    await fetch("/api/fcm/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch (error) {
    console.warn("FCM local cleanup failed:", error);
  }
}

export default function NotificationBell() {
  const [status, setStatus] = useState<DeviceStatus>("loading");
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
  });
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingKey, setSavingKey] = useState<NotificationPreferenceKey | null>(null);
  const [message, setMessage] = useState("");

  const loadSubscription = useCallback(async (subscription: PushSubscription) => {
    const credentials = subscriptionCredentials(subscription);
    if (!credentials.auth) throw new Error("L’abonnement de cet appareil est incomplet.");

    const response = await fetch("/api/push/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) throw new Error("Impossible de lire les réglages de cet appareil.");
    const result = await response.json();
    setPreferences(result.preferences);
    setDetails({
      device: displayDeviceLabel(result.device),
      createdAt: result.createdAt ?? null,
      lastNotifAt: result.lastNotifAt ?? null,
    });
    setStatus("active");
  }, []);

  useEffect(() => {
    const inspect = async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          setStatus("inactive");
          return;
        }
        await loadSubscription(subscription);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Lecture impossible.");
        setStatus("inactive");
      }
    };
    void inspect();
  }, [loadSubscription]);

  async function activate() {
    if (status === "unsupported") return;
    setBusy(true);
    setMessage("");
    try {
      if (Notification.permission === "denied") {
        setStatus("denied");
        throw new Error("Autorisez les notifications dans les réglages du navigateur ou du téléphone, puis réessayez.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "inactive");
        throw new Error("L’autorisation n’a pas été accordée.");
      }

      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        });
      const credentials = subscriptionCredentials(subscription);
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: credentials.endpoint,
          keys: { p256dh: credentials.p256dh, auth: credentials.auth },
          device: currentDeviceLabel(),
        }),
      });
      if (!response.ok) throw new Error("L’activation n’a pas pu être enregistrée.");
      await loadSubscription(subscription);
      setMessage("Notifications activées sur cet appareil.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const credentials = subscriptionCredentials(subscription);
        const response = await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: credentials.endpoint, auth: credentials.auth }),
        });
        if (!response.ok && response.status !== 404) {
          throw new Error("La désactivation n’a pas pu être enregistrée.");
        }
        await subscription.unsubscribe();
      }
      await unregisterLocalFcmToken(registration);
      setStatus("inactive");
      setDetails(null);
      setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
      setMessage("Notifications désactivées sur cet appareil.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Désactivation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePreference(key: NotificationPreferenceKey, checked: boolean) {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      setStatus("inactive");
      return;
    }

    const previous = preferences[key];
    setPreferences((current) => ({ ...current, [key]: checked }));
    setSavingKey(key);
    setMessage("");
    try {
      const credentials = subscriptionCredentials(subscription);
      const response = await fetch("/api/push/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: credentials.endpoint,
          auth: credentials.auth,
          preferences: { [key]: checked },
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Enregistrement impossible.");
      setPreferences(result.preferences);
      setMessage("Préférence enregistrée.");
    } catch (error) {
      setPreferences((current) => ({ ...current, [key]: previous }));
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSavingKey(null);
    }
  }

  const statusLabel = {
    loading: "Vérification…",
    active: "Activées",
    inactive: "Désactivées",
    denied: "Autorisation refusée",
    unsupported: "Appareil non compatible",
  }[status];

  const StatusIcon = status === "active"
    ? CheckCircle2
    : status === "denied"
      ? ShieldX
      : status === "loading"
        ? Loader2
        : BellOff;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-2.5 ${status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
            <StatusIcon size={22} className={status === "loading" ? "animate-spin" : ""} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold text-slate-900">Notifications sur cet appareil</h2>
            <p className="mt-1 text-sm font-bold text-slate-700">{statusLabel}</p>
            <div className="mt-2 space-y-0.5 text-xs text-slate-500">
              <p className="flex items-center gap-1.5"><MonitorSmartphone size={14} /> {details?.device ?? (status !== "loading" ? currentDeviceLabel() : "Appareil en cours de détection")}</p>
              {details?.createdAt && <p>Abonné depuis le {formatDate(details.createdAt)}</p>}
              {details?.lastNotifAt && <p>Dernière notification le {formatDate(details.lastNotifAt)}</p>}
            </div>
          </div>
        </div>

        <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">
          Ces réglages concernent uniquement cet appareil. Les autres téléphones ou ordinateurs conservent leurs propres réglages.
        </p>

        {message && <p role="status" className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{message}</p>}

        <div className="mt-4">
          {status === "active" ? (
            <button type="button" onClick={deactivate} disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-700 disabled:opacity-50">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <BellOff size={17} />}
              Désactiver sur cet appareil
            </button>
          ) : status !== "unsupported" && status !== "loading" ? (
            <button type="button" onClick={activate} disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 text-sm font-bold text-white disabled:opacity-50">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Bell size={17} />}
              {status === "denied" ? "Réessayer" : "Activer les notifications"}
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="font-extrabold text-slate-900">Notifications à recevoir</h2>
          <p className="mt-1 text-xs text-slate-500">Chaque choix est enregistré immédiatement pour cet appareil.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {PREFERENCE_LABELS.map((item) => (
            <label key={item.key} className={`flex min-h-16 items-center gap-3 py-3 ${status === "active" ? "cursor-pointer" : "opacity-50"}`}>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-800">{item.title}</span>
                <span className="mt-0.5 block text-xs leading-4 text-slate-500">{item.description}</span>
              </span>
              {savingKey === item.key && <Loader2 size={16} className="shrink-0 animate-spin text-green-700" />}
              <input
                type="checkbox"
                checked={preferences[item.key]}
                disabled={status !== "active" || savingKey !== null}
                onChange={(event) => void updatePreference(item.key, event.target.checked)}
                className="h-5 w-5 shrink-0 accent-green-700"
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

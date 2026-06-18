// Firebase compat SDKs (pour FCM background messages)
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDrnEYLnZ2hxTIkHiWlKKbvWf-PMGOWSdI",
  authDomain: "cesam-gaec-d781e.firebaseapp.com",
  projectId: "cesam-gaec-d781e",
  storageBucket: "cesam-gaec-d781e.firebasestorage.app",
  messagingSenderId: "119601604166",
  appId: "1:119601604166:web:a0aab26bcabc4350a98c47",
});

const messaging = firebase.messaging();

// FCM background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? "GAEC CESAM", {
    body: body ?? "",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: payload.data ?? {},
    tag: payload.data?.tag ?? "cesam-fcm",
    renotify: true,
  });
});

// VAPID web push (système existant)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  const data = e.data?.json() ?? {};
  const title = data.title ?? "GAEC CESAM";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body ?? "",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { url: data.url ?? "/" },
      tag: "cesam-push",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

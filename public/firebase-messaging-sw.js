importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Config injected at registration time via query params or hardcoded here.
// These are PUBLIC values — safe to include in a service worker.
firebase.initializeApp({
  apiKey: "AIzaSyDrnEYLnZ2hxTIkHiWlKKbvWf-PMGOWSdI",
  authDomain: "cesam-gaec-d781e.firebaseapp.com",
  projectId: "cesam-gaec-d781e",
  storageBucket: "cesam-gaec-d781e.firebasestorage.app",
  messagingSenderId: "119601604166",
  appId: "1:119601604166:web:a0aab26bcabc4350a98c47",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon, data } = payload.notification ?? {};
  self.registration.showNotification(title ?? "CESAM", {
    body: body ?? "",
    icon: icon ?? "/icon-192.png",
    badge: "/icon-192.png",
    data: data ?? payload.data,
    tag: data?.tag ?? "cesam-notif",
    renotify: true,
  });
});

// Notification click → focus or open the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
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

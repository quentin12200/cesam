// Service worker minimal — requis par Chrome pour le prompt d'installation PWA
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Passe-plat : pas de cache pour garder les données toujours fraîches
self.addEventListener("fetch", (e) => {
  e.respondWith(fetch(e.request));
});

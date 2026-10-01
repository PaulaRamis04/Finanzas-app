// Service worker de PocketZ: necesario para instalar la app (PWA / Google Play).
// Siempre pide la versión nueva a la red; la copia guardada solo se usa sin conexión.
// Supabase y las librerías externas no pasan por aquí.
const CACHE = "pocketz-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(c => c !== CACHE).map(c => caches.delete(c))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: req.mode === "navigate"})
      .then(r => r || (req.mode === "navigate" ? caches.match("./") : undefined))
      .then(r => r || Response.error()))
  );
});

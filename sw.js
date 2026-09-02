// Joystickd service worker — cautious by design.
// HTML is always network-first (updates land immediately); only same-origin
// static images are cached; Supabase and IGDB requests are never touched.
const CACHE = "joystickd-v1";

self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // never intercept Supabase/IGDB/etc.

  // Pages: network first, cached copy only as an offline fallback.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE); c.put("/", fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match("/");
        return cached || Response.error();
      }
    })());
    return;
  }

  // Static assets (trophies, icons): cache first, refresh in the background.
  if (/\.(png|webmanifest)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const cached = await c.match(req);
      const network = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
  }
});

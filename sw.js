// Joystickd service worker
// Strategy: the page itself (index.html) is NETWORK-FIRST — every cold start fetches the latest version when
// online and only falls back to the cached copy offline. That removes the old "launch twice to see an
// update" behaviour. Images and other static files are cache-first (they never change under the same name).
const CACHE = "joystickd-v3";

self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("message", e => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;              // Supabase, IGDB images, fonts: straight to network
  const isPage = req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith("/index.html") || url.pathname.endsWith(".html");
  if (isPage){
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const c = await caches.open(CACHE); c.put("/index.html", fresh.clone());
        return fresh;
      } catch (err) {
        return (await caches.match("/index.html")) || (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }
  // static assets: cache-first, fill cache on first use
  e.respondWith((async () => {
    const hit = await caches.match(req); if (hit) return hit;
    try { const res = await fetch(req); if (res.ok){ const c = await caches.open(CACHE); c.put(req, res.clone()); } return res; }
    catch (err) { return Response.error(); }
  })());
});

// Service worker: siden virker offline (dækningen på kirkegården er dårlig), og gentagne besøg
// henter kun positions.json over nettet. Alt andet serveres fra cachen og opdateres i baggrunden.
//
// VIGTIGT: Bump VERSION ved hvert deploy, der ændrer index.html, kortet, fonte eller ikoner.
// Ellers kan en gammel side hænge fast i cachen hos dem, der allerede har besøgt siden.
const VERSION = '2026-09-22';
const CACHE = 'traekort-' + VERSION;
const CORE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const key = url.pathname; // uden ?t=…, så positions.json?t=123 rammer samme post i cachen

  if (key.endsWith('/positions.json')) {
    // Netværk først: placeringerne må ikke være forældede. Offline gives sidst kendte kopi,
    // markeret med en header, så siden viser den, men ikke eksporterer oven på den.
    // Er der ingen kopi, fejler kaldet (som et netværksudfald), så eksporten stopper.
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(key, r.clone())); return r; })
        .catch(() => caches.match(key).then(hit => {
          if (!hit) throw new Error('offline');
          const h = new Headers(hit.headers); h.set('X-Offline-Cache', '1');
          return hit.text().then(t => new Response(t, { status: 200, headers: h }));
        }))
    );
    return;
  }

  // Alt andet: cache først, opdatér i baggrunden (stale-while-revalidate).
  e.respondWith(
    caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }))
  );
});

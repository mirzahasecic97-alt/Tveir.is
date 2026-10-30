/* ==========================================================================
   Tveir vinnusvæði — þjónustustarfi
   Geymir ekkert nema sambandsleysissíðuna. Allt annað kemur af netinu,
   svo enginn sitji uppi með gamla útgáfu af kóðanum.
   ========================================================================== */

const GEYMSLA = 'tveir-vinnusvaedi-v1';
const EKKERT_SAMBAND = '/vinnusvaedi/ekkert-samband.html';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(GEYMSLA)
      .then((g) => g.add(EKKERT_SAMBAND))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((lyklar) => Promise.all(
        lyklar.filter((l) => l !== GEYMSLA).map((l) => caches.delete(l))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(EKKERT_SAMBAND))
  );
});

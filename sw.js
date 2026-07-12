// Service worker minimal untuk Nanu — stale-while-revalidate utk aset same-origin,
// biar PWA/TWA punya sedikit ketahanan offline. Endpoint /api/* selalu lewat network
// langsung (datanya harus selalu segar, tak boleh basi).
const CACHE = 'nanu-v1';
const PRECACHE_URLS = [
  '/',
  '/daftar-nama',
  '/nama-tersimpan',
  '/manifest.json',
  '/favicon-nanu.svg',
  '/support.js',
  '/nanu-chrome.js',
  '/nanu-supabase.js',
  '/assets/nanu-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // biarkan CDN/pihak ketiga apa adanya
  if (url.pathname.startsWith('/api/')) return; // jangan pernah cache respons API

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

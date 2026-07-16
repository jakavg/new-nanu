// Service worker minimal untuk Nanu — biar PWA/TWA punya sedikit ketahanan offline.
// Endpoint /api/* selalu lewat network langsung (datanya harus selalu segar).
//
// Dua strategi berbeda, sengaja dipisah:
// - Navigasi HTML (buka halaman) → NETWORK-FIRST. Isinya bisa berubah kapan saja
//   (harga, teks legal, dll) dan harus selalu segar selama online; cache cuma
//   fallback saat benar-benar offline. (Bug nyata yang pernah terjadi: pakai
//   stale-while-revalidate di sini bikin user melihat harga LAMA karena versi
//   cache disajikan duluan sebelum revalidasi network selesai.)
// - Aset statis same-origin (js/gambar) → stale-while-revalidate, aman karena
//   jarang berubah dan staleness sebentar tak berdampak.
//
// CACHE dinaikkan versinya tiap kali strategi/precache berubah, supaya activate()
// membuang cache lama (termasuk entri HTML basi) alih-alih menunggu overwrite alami.
const CACHE = 'nanu-v2';
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

  // Navigasi (buka/refresh halaman): network-first. Isinya (harga, teks legal,
  // dll) harus selalu segar saat online; cache cuma dipakai kalau network gagal.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Aset statis same-origin: stale-while-revalidate (aman, jarang berubah).
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

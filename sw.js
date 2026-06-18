const CACHE_NAME = 'sara-arch-v188';
const STATIC_ASSETS = [
  '/Sara-Arch/',
  '/Sara-Arch/index.html',
  '/Sara-Arch/css/style.css',
  '/Sara-Arch/js/config.js',
  '/Sara-Arch/js/api.js',
  '/Sara-Arch/js/auth.js',
  '/Sara-Arch/js/ui.js',
  '/Sara-Arch/js/app-core.js',
  '/Sara-Arch/js/app-loaders.js',
  '/Sara-Arch/js/app-reports.js',
  '/Sara-Arch/js/crud.js',
  '/Sara-Arch/logo.png',
  '/Sara-Arch/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname !== self.location.hostname) return;
  if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/rest/')) return;

  // Always fetch version.json fresh (no cache)
  if (url.pathname.endsWith('version.json')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // For JS/CSS with version query param, always fetch fresh
  if (url.search && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return response;
      });
    }).catch(() => fetch(event.request))
  );
});

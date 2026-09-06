const CACHE_NAME = 'sara-arch-v303';
const STATIC_ASSETS = [
  '/Sara-Arch/',
  '/Sara-Arch/index.html',
  '/Sara-Arch/css/style.css',
  '/Sara-Arch/js/config.js',
  '/Sara-Arch/js/api.js',
  '/Sara-Arch/js/auth.js',
  '/Sara-Arch/js/ui.js',
  '/Sara-Arch/js/sync.js',
  '/Sara-Arch/js/app-core.js',
  '/Sara-Arch/js/app-loaders.js',
  '/Sara-Arch/js/app-reports.js',
  '/Sara-Arch/js/crud.js',
  '/Sara-Arch/logo.png',
  '/Sara-Arch/manifest.json',
  '/Sara-Arch/offline.html'
];

const SYNC_DB_NAME = 'sara-sync';
const SYNC_QUEUE_STORE = 'queue';
const SYNC_META_STORE = 'meta';

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

// ─── IndexedDB helpers for background sync queue ───
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SYNC_DB_NAME, 1);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const store = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(SYNC_META_STORE)) {
        db.createObjectStore(SYNC_META_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = (event) => resolve(event.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueInSW(request, bodyText) {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const headers = {};
    request.headers.forEach((value, key) => { headers[key] = value; });
    const item = {
      url: request.url,
      method: request.method,
      headers,
      body: bodyText ? JSON.parse(bodyText) : null,
      table: '',
      description: 'عملية أثناء عدم الاتصال',
      createdAt: Date.now(),
      attempts: 0,
      lastError: null
    };
    const req = store.add(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function listQueue() {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readonly');
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const req = store.index('createdAt').openCursor();
    const items = [];
    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) { items.push(cursor.value); cursor.continue(); }
      else resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function removeFromQueue(id) {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const req = tx.objectStore(SYNC_QUEUE_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function updateQueueItem(item) {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const req = tx.objectStore(SYNC_QUEUE_STORE).put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function setLastSyncSW() {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_META_STORE, 'readwrite');
    const req = tx.objectStore(SYNC_META_STORE).put({ key: 'lastSync', value: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function replayQueue() {
  const items = await listQueue();
  if (!items.length) return { succeeded: 0, failed: 0 };
  let succeeded = 0;
  let failed = 0;
  for (const item of items) {
    try {
      item.attempts += 1;
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body ? JSON.stringify(item.body) : undefined
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      await removeFromQueue(item.id);
      succeeded += 1;
    } catch (e) {
      item.lastError = e.message;
      await updateQueueItem(item);
      failed += 1;
    }
  }
  if (succeeded) await setLastSyncSW();
  return { succeeded, failed };
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sara-sync') {
    event.waitUntil(replayQueue());
  }
});

// ─── Fetch handling ───
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Queue mutating requests that fail due to network loss
  if (event.request.method !== 'GET' && url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        try {
          const cloned = event.request.clone();
          const bodyText = await cloned.text().catch(() => null);
          const response = await fetch(event.request);
          await setLastSyncSW();
          return response;
        } catch (err) {
          try {
            const bodyText = await event.request.clone().text().catch(() => null);
            await enqueueInSW(event.request, bodyText);
            // Notify clients that a mutation was queued
            const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            clients.forEach((client) => client.postMessage({ type: 'SYNC_QUEUED' }));
          } catch (queueErr) {
            // ignore queue errors
          }
          return new Response(JSON.stringify({ message: 'تم حفظ العملية للمزامنة لاحقًا' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })()
    );
    return;
  }

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

  const isNavigation = event.request.mode === 'navigate';
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        if (isNavigation) {
          fetch(event.request, { cache: 'no-store' }).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
          }).catch(() => {});
        }
        return cached;
      }
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return response;
      }).catch(() => {
        if (isNavigation) {
          return caches.match('/Sara-Arch/offline.html').then((offline) => offline || fetch(event.request));
        }
        return fetch(event.request);
      });
    })
  );
});

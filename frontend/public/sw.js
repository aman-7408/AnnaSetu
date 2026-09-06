const CACHE_NAME = 'annasetu-pwa-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/logo.jpg',
  '/wheat-bg.jpg',
  '/favicon.svg'
];

// Install Event: Pre-cache App Shell & Skip Waiting immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Wipe all old cache versions & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-First for all dynamic routes, API & scripts; Cache fallback for offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests or browser-extension schemes
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Bypass dev server HMR and Vite modules completely
  if (url.pathname.includes('/@vite') || url.pathname.includes('/@fs') || url.pathname.includes('/@id') || url.pathname.includes('node_modules')) {
    return;
  }

  // 1. API Requests (Network-First with offline cache fallback)
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(
            JSON.stringify({ 
              success: false, 
              offline: true, 
              error: 'You are currently offline. Showing cached Mandi data.' 
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // 2. Navigation & Static Assets: Network-First with Cache Fallback for instant updates
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        if (request.mode === 'navigate') {
          return (await caches.match('/index.html')) || (await caches.match('/'));
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

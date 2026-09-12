const CACHE_NAME = 'pocket-ide-shell-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/assets/logo.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/js/main.js',
  '/js/auth.js',
  '/js/ws-client.js',
  '/js/pwa.js',
  '/js/views/chat-view.js',
  '/js/views/diff-view.js',
  '/js/views/files-view.js'
];

// Install: Pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up stale caches
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

// Fetch: Network-first for dynamic endpoints, Cache-first for shell assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass cache completely for API, uploads, dashboard, and WebSockets
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/uploads/') ||
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/ws') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh in background (stale-while-revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {});

        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});

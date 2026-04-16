const CACHE_NAME = 'restaurantos-v15'; // change version when needed

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles/main.css',

  './js/config.js',
  './js/store.js',
  './js/chartLib.js',
  './js/app.js',
  './js/main.js',
  './qr/bkash.jpeg',
  './qr/nagad.png',
  './qr/rocket.png',
  './js/modules/profile.js',
  './js/modules/dashboard.js',
  './js/modules/menuEngine.js',
  './js/modules/floorMap.js',
  './js/modules/pos.js',
  './js/modules/publicHome.js',
  './js/modules/kitchen.js',
  './js/modules/inventory.js',
  './js/modules/analytics.js',
  './js/modules/billing.js',
  './js/modules/staff.js',
  './js/modules/syncCenter.js',
  './js/modules/security.js',

  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

// Install: cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          const response = await fetch(asset, { cache: 'no-cache' });
          if (response.ok) {
            await cache.put(asset, response.clone());
            console.log('[SW] Cached:', asset);
          }
        } catch (error) {
          console.warn('[SW] Failed to cache:', asset, error);
        }
      }
    })
  );
});

// Activate: remove old caches and take control immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - navigation/documents: network first, fallback to cache
// - JS/CSS/images: stale-while-revalidate
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // HTML/navigation => network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', cloned));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets => stale while revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
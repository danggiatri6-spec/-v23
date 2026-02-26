
const CACHE_NAME = 'wealthtrack-v24-cache';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './index.tsx',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Do not intercept API calls or cross-origin requests to Google/AI services
  if (
    event.request.method !== 'GET' || 
    event.request.url.includes('googlevideo.com') ||
    event.request.url.includes('generativelanguage.googleapis.com') ||
    event.request.url.includes('aiBridge')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;

      return fetch(event.request).then((fetchResponse) => {
        if (event.request.mode === 'navigate' && fetchResponse.status !== 200) {
          return caches.match('./index.html');
        }

        if (fetchResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return fetchResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return null;
      });
    })
  );
});

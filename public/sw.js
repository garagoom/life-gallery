const IMAGE_CACHE = 'life-gallery-images-v1';
const API_CACHE = 'life-gallery-api-v1';
const STATIC_CACHE = 'life-gallery-static-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => ![IMAGE_CACHE, API_CACHE, STATIC_CACHE].includes(k))
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Images (uploads + thumbnails + any image request)
  if (url.pathname.startsWith('/uploads/') ||
      url.pathname.startsWith('/thumbnails/') ||
      request.destination === 'image' ||
      url.pathname.match(/\.(jpe?g|png|webp|gif|svg)$/i)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => new Response('', { status: 408 }));
        })
      )
    );
    return;
  }

  // API: Stale While Revalidate
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE).then(cache =>
        cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Static assets
  if (url.pathname.match(/\.(js|css|woff2?|ico)$/i) ||
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'font') {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
  }
});

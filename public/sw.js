const IMAGE_CACHE = 'life-gallery-images-v2';
const API_CACHE = 'life-gallery-api-v1';
const STATIC_CACHE = 'life-gallery-static-v2';
const IMAGE_CACHE_LIMIT = 80;

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

async function putWithLimit(cacheName, request, response, limit) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  const keys = await cache.keys();
  if (keys.length > limit) {
    const extra = keys.length - limit;
    await Promise.all(keys.slice(0, extra).map((key) => cache.delete(key)));
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  const isFullOriginal = /^\/uploads\/(?!avatars\/)/.test(url.pathname);
  if (isFullOriginal) return;

  if (url.pathname.startsWith('/uploads/') ||
      url.pathname.startsWith('/thumbnails/') ||
      url.pathname.startsWith('/mediums/') ||
      request.destination === 'image' ||
      url.pathname.match(/\.(jpe?g|png|webp|avif|gif|svg)$/i)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response.ok) {
              putWithLimit(IMAGE_CACHE, request, response.clone(), IMAGE_CACHE_LIMIT);
            }
            return response;
          }).catch(() => new Response('', { status: 408 }));
        })
      )
    );
    return;
  }

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

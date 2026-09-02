import { useRef, useEffect } from 'react';
import { getRandomPhotos } from '../api/photos';
import { getPhotoUrl } from './photos';
import { isAuthenticated } from '../api/auth';

const CACHE_KEY = 'preloadedPhotos';
const CACHE_TS_KEY = 'preloadedPhotosTs';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let preloadPromise = null;

function doPreload() {
  if (preloadPromise) return preloadPromise;

  // Skip preload if not logged in — API will return 401 and cause redirect loop
  if (!isAuthenticated()) {
    return Promise.resolve([]);
  }

  preloadPromise = (async () => {
    try {
      const result = await getRandomPhotos(20);
      const photos = result.data || [];
      if (photos.length === 0) {
        preloadPromise = null;
        return photos;
      }

      // Preload images into browser cache
      await Promise.allSettled(
        photos.map((photo) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve;
            img.src = getPhotoUrl(photo);
          })
        )
      );

      // Cache photo data
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(photos));
        sessionStorage.setItem(CACHE_TS_KEY, String(Date.now()));
      } catch (e) { /* quota exceeded, ignore */ }

      return photos;
    } catch (err) {
      console.error('Preload failed:', err);
      preloadPromise = null;
      return [];
    }
  })();

  return preloadPromise;
}

export function useImagePreloader() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    doPreload();
  }, []);
}

export function getCachedPhotos() {
  try {
    const ts = parseInt(sessionStorage.getItem(CACHE_TS_KEY) || '0');
    if (Date.now() - ts > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(CACHE_TS_KEY);
      return null;
    }
    const data = sessionStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function getOrPreloadPhotos() {
  const cached = getCachedPhotos();
  if (cached && cached.length > 0) return cached;
  return await doPreload();
}

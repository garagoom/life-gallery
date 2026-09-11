const photoCache = new Map();

export function cachePhoto(id, photo) {
  photoCache.set(String(id), photo);
}

export function getCachedPhoto(id) {
  return photoCache.get(String(id)) || null;
}

export function cachePhotoList(photos) {
  for (const p of photos) {
    if (p?.id) photoCache.set(String(p.id), p);
  }
}

const loadedUrls = new Set();
const inflight = new Map();

export function isImageLoaded(url) {
  return loadedUrls.has(url);
}

export function markImageLoaded(url) {
  if (url) loadedUrls.add(url);
}

export function prefetchImage(url) {
  if (!url) return Promise.resolve(null);
  const pending = inflight.get(url);
  if (pending) return pending;

  const readDims = (img) => (
    img.naturalWidth > 0
      ? { width: img.naturalWidth, height: img.naturalHeight }
      : null
  );

  if (loadedUrls.has(url)) {
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        resolve(value);
      };
      img.onload = () => finish(readDims(img));
      img.onerror = () => finish(null);
      img.src = url;
      if (img.complete) finish(readDims(img));
    });
  }

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      loadedUrls.add(url);
      inflight.delete(url);
      resolve(readDims(img));
    };
    img.onerror = () => {
      inflight.delete(url);
      resolve(null);
    };
    img.src = url;
  });

  inflight.set(url, promise);
  return promise;
}

export function prefetchImages(urls) {
  return Promise.allSettled((urls || []).filter(Boolean).map(prefetchImage));
}

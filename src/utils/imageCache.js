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

const imageLoadCache = new Map();

export function isImageLoaded(url) {
  return imageLoadCache.has(url);
}

export function markImageLoaded(url) {
  imageLoadCache.set(url, true);
}

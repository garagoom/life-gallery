import { lumaValue } from './extractHistogram';

const MAX_EDGE = 400;
const BINS = 256;

export function emptyParade() {
  return {
    cols: 0,
    r: new Uint32Array(0),
    g: new Uint32Array(0),
    b: new Uint32Array(0),
    l: new Uint32Array(0),
  };
}

export function extractRgbParadeFromPixels(pixels, width, height) {
  const w = width | 0;
  const h = height | 0;
  if (!w || !h || !pixels?.length) return emptyParade();

  const r = new Uint32Array(w * BINS);
  const g = new Uint32Array(w * BINS);
  const b = new Uint32Array(w * BINS);
  const l = new Uint32Array(w * BINS);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (pixels[i + 3] < 16) continue;
      const rv = pixels[i];
      const gv = pixels[i + 1];
      const bv = pixels[i + 2];
      const base = x * BINS;
      r[base + rv]++;
      g[base + gv]++;
      b[base + bv]++;
      l[base + lumaValue(rv, gv, bv)]++;
    }
  }

  return { cols: w, r, g, b, l };
}

export function extractRgbParade(img) {
  const srcW = img.naturalWidth || img.width || 0;
  const srcH = img.naturalHeight || img.height || 0;
  if (!srcW || !srcH) return emptyParade();

  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  return extractRgbParadeFromPixels(ctx.getImageData(0, 0, w, h).data, w, h);
}

export function toggleChannel(visible, key) {
  const next = { ...visible, [key]: !visible[key] };
  if (!next.r && !next.g && !next.b && !next.l) return visible;
  return next;
}

export function lumaValue(r, g, b) {
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

function emptyBins() {
  return new Array(256).fill(0);
}

function toHex(r, g, b) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function analyzeRgba(data, channels = 4) {
  const r = emptyBins();
  const g = emptyBins();
  const b = emptyBins();
  const l = emptyBins();
  const buckets = new Map();

  for (let i = 0; i < data.length; i += channels) {
    const alpha = channels === 4 ? data[i + 3] : 255;
    if (alpha < 16) continue;
    const rv = data[i];
    const gv = data[i + 1];
    const bv = data[i + 2];
    r[rv] += 1;
    g[gv] += 1;
    b[bv] += 1;
    l[lumaValue(rv, gv, bv)] += 1;

    const key = ((rv >> 5) << 6) | ((gv >> 5) << 3) | (bv >> 5);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, r: 0, g: 0, b: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    bucket.r += rv;
    bucket.g += gv;
    bucket.b += bv;
  }

  const palette = [...buckets.values()]
    .sort((a, c) => c.count - a.count)
    .slice(0, 6)
    .map((bucket) => {
      const pr = Math.round(bucket.r / bucket.count);
      const pg = Math.round(bucket.g / bucket.count);
      const pb = Math.round(bucket.b / bucket.count);
      const hex = toHex(pr, pg, pb);
      return { hex, rgb: `rgb(${pr}, ${pg}, ${pb})` };
    });

  return { histogram: { r, g, b, l }, palette };
}

export function extractImageAnalysis(img) {
  const srcW = img.naturalWidth || img.width || 0;
  const srcH = img.naturalHeight || img.height || 0;
  if (!srcW || !srcH) {
    return { histogram: { r: emptyBins(), g: emptyBins(), b: emptyBins(), l: emptyBins() }, palette: [] };
  }

  const scale = Math.min(1, 400 / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h).data;
  return analyzeRgba(pixels, 4);
}

export function parseStoredHistogram(value) {
  if (!value) return null;
  if (typeof value === 'object' && value.r && value.g && value.b) return value;
  try {
    const parsed = JSON.parse(value);
    if (parsed?.r && parsed?.g && parsed?.b) return parsed;
  } catch { /* ignore */ }
  return null;
}

export function parseStoredPalette(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

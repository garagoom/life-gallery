function lumaValue(r, g, b) {
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

function emptyBins() {
  return new Array(256).fill(0);
}

function toHex(r, g, b) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function analyzeRgba(data, channels = 4) {
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

module.exports = { lumaValue, analyzeRgba };

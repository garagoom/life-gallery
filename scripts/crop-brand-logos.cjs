const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '..', 'public', 'images', 'brands');
const RENDER = 1200;
const ALPHA = 10;
const PAD_RATIO = 0.02;
const MIN_WASTE = 0.08;

function parseViewBox(svg) {
  const match = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (!match) return null;
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minX, minY, width, height] = parts;
  if (width <= 0 || height <= 0) return null;
  return { minX, minY, width, height };
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function findOpaqueBox(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x * 4 + 3] <= ALPHA) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

function prepareForMeasure(svg) {
  return svg
    .replace(/fill="currentColor"/gi, 'fill="#000000"')
    .replace(/stroke="currentColor"/gi, 'stroke="#000000"')
    .replace(/fill:currentColor/gi, 'fill:#000000')
    .replace(/stroke:currentColor/gi, 'stroke:#000000');
}

async function cropFile(file) {
  const original = fs.readFileSync(file, 'utf8');
  const viewBox = parseViewBox(original);
  if (!viewBox) return { name: path.basename(file), skipped: 'no viewBox' };

  const width = RENDER;
  const height = Math.max(1, Math.round(RENDER * (viewBox.height / viewBox.width)));
  let info;
  let data;
  try {
    const rendered = await sharp(Buffer.from(prepareForMeasure(original)))
      .resize(width, height, { fit: 'fill', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = rendered.data;
    info = rendered.info;
  } catch (err) {
    return { name: path.basename(file), skipped: err.message };
  }

  const box = findOpaqueBox(data, info.width, info.height);
  if (!box) return { name: path.basename(file), skipped: 'empty render' };

  const contentMinX = viewBox.minX + (box.minX / info.width) * viewBox.width;
  const contentMinY = viewBox.minY + (box.minY / info.height) * viewBox.height;
  const contentMaxX = viewBox.minX + ((box.maxX + 1) / info.width) * viewBox.width;
  const contentMaxY = viewBox.minY + ((box.maxY + 1) / info.height) * viewBox.height;
  const contentW = contentMaxX - contentMinX;
  const contentH = contentMaxY - contentMinY;
  const pad = Math.max(contentW, contentH) * PAD_RATIO;
  const next = {
    minX: contentMinX - pad,
    minY: contentMinY - pad,
    width: contentW + pad * 2,
    height: contentH + pad * 2,
  };

  const wasteX = 1 - next.width / viewBox.width;
  const wasteY = 1 - next.height / viewBox.height;
  if (wasteX < MIN_WASTE && wasteY < MIN_WASTE) {
    return { name: path.basename(file), skipped: 'already tight' };
  }

  const value = `${round(next.minX)} ${round(next.minY)} ${round(next.width)} ${round(next.height)}`;
  let svg = original.replace(/viewBox\s*=\s*"[^"]+"/i, `viewBox="${value}"`);
  svg = svg.replace(/\s(?:width|height)="[^"]*"/gi, '');
  fs.writeFileSync(file, svg);
  return {
    name: path.basename(file),
    from: `${viewBox.width}x${viewBox.height}`,
    to: `${round(next.width)}x${round(next.height)}`,
  };
}

async function main() {
  const files = fs.readdirSync(DIR).filter((name) => name.toLowerCase().endsWith('.svg'));
  const cropped = [];
  const skipped = [];
  for (const name of files) {
    const result = await cropFile(path.join(DIR, name));
    if (result.skipped) skipped.push(result);
    else cropped.push(result);
  }
  console.log(`cropped ${cropped.length}`);
  for (const item of cropped) {
    console.log(`  ${item.name}: ${item.from} -> ${item.to}`);
  }
  if (skipped.length) {
    console.log(`skipped ${skipped.length}`);
    for (const item of skipped) {
      console.log(`  ${item.name}: ${item.skipped}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

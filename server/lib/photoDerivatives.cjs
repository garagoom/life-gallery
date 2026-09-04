const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { analyzeRgba } = require('./imageAnalysis.cjs');

function avifCompanion(filename) {
  if (!filename || !/\.webp$/i.test(filename)) return null;
  return filename.replace(/\.webp$/i, '.avif');
}

function lookupName(filename) {
  if (filename && /\.avif$/i.test(filename)) {
    return filename.replace(/\.avif$/i, '.webp');
  }
  return filename;
}

async function encodeAvif(src, dest, width) {
  await sharp(src)
    .rotate()
    .resize(width, null, { withoutEnlargement: true })
    .avif({ quality: 45 })
    .toFile(dest);
}

async function analyzeSource(src) {
  const sample = await sharp(src)
    .rotate()
    .resize(400, 400, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return analyzeRgba(sample.data, sample.info.channels || 4);
}

function fileExists(filePath) {
  try {
    return Boolean(filePath && fs.existsSync(filePath));
  } catch {
    return false;
  }
}

async function ensurePhotoDerivatives(photo, dirs) {
  const uploadPath = photo.filename && path.join(dirs.uploads, photo.filename);
  if (!fileExists(uploadPath)) {
    return null;
  }

  const baseName = path.parse(photo.filename).name;
  const patch = {};
  let hasAvif = Number(photo.has_avif) === 1;

  const meta = await sharp(uploadPath).metadata();
  if (!photo.width || !photo.height) {
    patch.width = meta.width || null;
    patch.height = meta.height || null;
  }

  const mediumName = photo.medium || `mid-${baseName}.webp`;
  const mediumPath = path.join(dirs.mediums, mediumName);
  if (!fileExists(mediumPath)) {
    await sharp(uploadPath)
      .rotate()
      .resize(1200, null, { withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(mediumPath);
  }
  if (!photo.medium) patch.medium = mediumName;

  const thumbName = photo.thumbnail || `thumb-${baseName}.webp`;
  const thumbPath = path.join(dirs.thumbnails, thumbName);
  if (!fileExists(thumbPath)) {
    await sharp(uploadPath)
      .rotate()
      .resize(300, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbPath);
    if (!photo.thumbnail) patch.thumbnail = thumbName;
  }

  const mediumAvif = path.join(dirs.mediums, avifCompanion(mediumName));
  const thumbAvif = path.join(dirs.thumbnails, avifCompanion(thumbName));
  try {
    if (!fileExists(mediumAvif)) await encodeAvif(uploadPath, mediumAvif, 1200);
    if (fileExists(thumbPath) && !fileExists(thumbAvif)) await encodeAvif(thumbPath, thumbAvif, 300);
    hasAvif = true;
  } catch (err) {
    console.warn(`AVIF encode failed for ${photo.filename}:`, err.message);
  }

  if (!photo.histogram || !photo.palette) {
    const analysis = await analyzeSource(uploadPath);
    if (!photo.histogram) patch.histogram = JSON.stringify(analysis.histogram);
    if (!photo.palette) patch.palette = JSON.stringify(analysis.palette);
  }

  if (hasAvif && Number(photo.has_avif) !== 1) patch.has_avif = 1;

  return Object.keys(patch).length ? patch : (hasAvif && Number(photo.has_avif) !== 1 ? { has_avif: 1 } : null);
}

async function backfillMissingDerivatives(getDb, dirs) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, filename, thumbnail, medium, width, height, histogram, palette, has_avif
    FROM photos
  `);
  const photos = [];
  while (stmt.step()) photos.push(stmt.getAsObject());
  stmt.free();

  let updated = 0;
  for (const photo of photos) {
    const complete = photo.medium && photo.width && photo.height && photo.histogram && photo.palette && Number(photo.has_avif) === 1;
    if (complete) continue;
    try {
      const patch = await ensurePhotoDerivatives(photo, dirs);
      if (!patch) continue;
      const fields = Object.keys(patch).filter((key) => (
        ['width', 'height', 'medium', 'thumbnail', 'histogram', 'palette', 'has_avif'].includes(key)
      ));
      if (!fields.length) continue;
      db.run(
        `UPDATE photos SET ${fields.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`,
        [...fields.map((key) => patch[key]), photo.id]
      );
      updated += 1;
    } catch (err) {
      console.warn(`Backfill skipped for photo ${photo.id}:`, err.message);
    }
  }
  if (updated) {
    console.log(`Backfilled derivatives for ${updated} photos`);
  }
  return updated;
}

module.exports = {
  avifCompanion,
  lookupName,
  encodeAvif,
  ensurePhotoDerivatives,
  backfillMissingDerivatives,
};

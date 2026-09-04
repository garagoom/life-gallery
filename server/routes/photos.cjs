const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const exifReader = require('exif-reader');
const { getDb, saveDb } = require('../db.cjs');
const { authMiddleware, optionalAuth } = require('../middleware/auth.cjs');
const { requireMenu, hasMenu } = require('../middleware/permission.cjs');
const { canViewPhoto } = require('../middleware/media.cjs');
const { analyzeRgba } = require('../lib/imageAnalysis.cjs');
const { avifCompanion, encodeAvif } = require('../lib/photoDerivatives.cjs');

const router = express.Router();

// Ensure directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const thumbnailsDir = path.join(__dirname, '..', 'thumbnails');
const mediumsDir = path.join(__dirname, '..', 'mediums');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(thumbnailsDir, { recursive: true });
fs.mkdirSync(mediumsDir, { recursive: true });

const LIST_FIELDS = `p.id, p.title, p.filename, p.thumbnail, p.medium, p.date, p.category, p.rotation,
  p.camera_make, p.camera_model, p.exposure_time, p.f_number, p.iso, p.focal_length,
  p.uploaded_by, p.review_status, p.width, p.height, p.has_avif, p.created_at,
  u.display_name AS uploader_display_name, u.avatar AS uploader_avatar`;

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('仅支持 JPEG、PNG、WebP、HEIC 格式'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Standard response helpers
function success(res, data = null, message = 'success', code = 200) {
  return res.status(code).json({
    code,
    message,
    data
  });
}

function error(res, message = '操作失败', code = 500) {
  return res.status(code).json({
    code,
    message,
    data: null
  });
}

function paginate(res, data, pagination, message = 'success') {
  return res.status(200).json({
    code: 200,
    message,
    data,
    pagination
  });
}

// Safe date formatter
function formatDateValue(dateValue) {
  if (!dateValue) return null;
  
  if (typeof dateValue === 'string') {
    if (dateValue.includes(':')) {
      const parts = dateValue.split(' ')[0].split(':');
      if (parts.length === 3) {
        return `${parts[0]}-${parts[1]}-${parts[2]}`;
      }
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
      return dateValue.split('T')[0];
    }
  }
  
  if (dateValue instanceof Date) {
    return dateValue.toISOString().split('T')[0];
  }
  
  if (typeof dateValue === 'object' && dateValue.toString) {
    const str = dateValue.toString();
    if (str.includes(':')) {
      const parts = str.split(' ')[0].split(':');
      if (parts.length === 3) {
        return `${parts[0]}-${parts[1]}-${parts[2]}`;
      }
    }
  }
  
  return null;
}

// Extract EXIF data from image (GPS is intentionally skipped for now)
async function extractExif(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    
    let exifData = {};
    if (metadata.exif) {
      try {
        exifData = exifReader(metadata.exif);
      } catch (e) {
        console.error('EXIF parse error:', e);
      }
    }
    
    const image = exifData.Image || {};
    const photo = exifData.Photo || {};
    const exifIFD = exifData.exif || {};
    
    return {
      make: image.Make || null,
      model: image.Model || null,
      exposureTime: photo.ExposureTime || exifIFD.ExposureTime || null,
      fNumber: photo.FNumber || exifIFD.FNumber || null,
      iso: photo.ISOSpeedRatings || exifIFD.ISOSpeedRatings || null,
      focalLength: photo.FocalLength || exifIFD.FocalLength || null,
      dateTime: image.DateTime || photo.DateTimeOriginal || null,
      width: metadata.width,
      height: metadata.height,
      software: image.Software || null,
      lensModel: photo.LensModel || exifIFD.LensModel || null,
      whiteBalance: photo.WhiteBalance ?? exifIFD.WhiteBalance ?? null,
      meteringMode: photo.MeteringMode ?? exifIFD.MeteringMode ?? null,
      exposureBias: photo.ExposureBiasValue ?? photo.ExposureCompensation ?? exifIFD.ExposureBiasValue ?? null,
      flash: photo.Flash ?? exifIFD.Flash ?? null,
      colorSpace: photo.ColorSpace || exifIFD.ColorSpace || null,
    };
  } catch (error) {
    console.error('EXIF extraction error:', error);
    return {
      make: null, model: null, exposureTime: null, fNumber: null,
      iso: null, focalLength: null, dateTime: null, width: null,
      height: null, software: null, lensModel: null, whiteBalance: null,
      meteringMode: null, exposureBias: null, flash: null, colorSpace: null,
    };
  }
}

// Format EXIF data for display
function formatExif(exif) {
  const formatExposure = (time) => {
    if (!time) return null;
    if (typeof time === 'object' && time.numerator && time.denominator) {
      const val = time.numerator / time.denominator;
      return val < 1 ? `1/${Math.round(1 / val)}` : `${val}`;
    }
    return time < 1 ? `1/${Math.round(1 / time)}` : `${time}`;
  };

  const formatFNumber = (f) => {
    if (!f) return null;
    if (typeof f === 'object' && f.numerator && f.denominator) {
      return `f/${(f.numerator / f.denominator).toFixed(1)}`;
    }
    return `f/${f}`;
  };

  const formatFocalLength = (fl) => {
    if (!fl) return null;
    if (typeof fl === 'object' && fl.numerator && fl.denominator) {
      return `${Math.round(fl.numerator / fl.denominator)}mm`;
    }
    return `${Math.round(fl)}mm`;
  };

  const meteringLabels = {
    0: '未知', 1: '平均测光', 2: '中央重点测光', 3: '点测光',
    4: '多点测光', 5: '评价测光', 6: '局部测光', 255: '其他',
  };
  const formatMetering = (mode) => {
    if (mode == null || mode === '') return null;
    const num = Number(mode);
    if (Number.isFinite(num) && meteringLabels[num] != null) return meteringLabels[num];
    return String(mode);
  };

  const formatWhiteBalance = (wb) => {
    if (wb == null || wb === '') return null;
    const num = Number(wb);
    if (num === 0) return '自动';
    if (num === 1) return '手动';
    return String(wb);
  };

  const formatExposureBias = (val) => {
    if (val == null || val === '') return null;
    let num;
    if (typeof val === 'object' && val.numerator != null && val.denominator) {
      num = val.numerator / val.denominator;
    } else {
      num = Number(val);
    }
    if (!Number.isFinite(num)) return null;
    if (Math.abs(num) < 0.01) return '0 EV';
    const thirds = Math.round(num * 3);
    if (Math.abs(num * 3 - thirds) < 0.08) {
      const sign = thirds > 0 ? '+' : '-';
      const abs = Math.abs(thirds);
      if (abs % 3 === 0) return `${sign}${abs / 3} EV`;
      return `${sign}${abs}/3 EV`;
    }
    const rounded = Math.round(num * 10) / 10;
    const sign = rounded > 0 ? '+' : '';
    return `${sign}${String(rounded)} EV`;
  };

  return {
    make: exif.make,
    model: exif.model,
    exposureTime: formatExposure(exif.exposureTime),
    fNumber: formatFNumber(exif.fNumber),
    iso: exif.iso ? `ISO-${exif.iso}` : null,
    focalLength: formatFocalLength(exif.focalLength),
    dateTime: formatDateValue(exif.dateTime),
    width: exif.width,
    height: exif.height,
    software: exif.software,
    lensModel: exif.lensModel,
    whiteBalance: formatWhiteBalance(exif.whiteBalance),
    meteringMode: formatMetering(exif.meteringMode),
    exposureBias: formatExposureBias(exif.exposureBias),
    flash: exif.flash,
    colorSpace: exif.colorSpace,
  };
}

// Process and save a single photo file
async function processPhoto(file, title, date, category) {
  const baseName = path.parse(file.filename).name;
  const webpFilename = baseName + '.webp';
  const webpPath = path.join(uploadsDir, webpFilename);
  const thumbnailName = 'thumb-' + baseName + '.webp';
  const thumbnailPath = path.join(thumbnailsDir, thumbnailName);
  const mediumName = 'mid-' + baseName + '.webp';
  const mediumPath = path.join(mediumsDir, mediumName);

  const exif = await extractExif(file.path);
  const formattedExif = formatExif(exif);

  const pipeline = sharp(file.path).rotate();
  const [fullInfo, , , sample] = await Promise.all([
    pipeline
      .clone()
      .resize(3840, null, { withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(webpPath),
    pipeline
      .clone()
      .resize(1200, null, { withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(mediumPath),
    pipeline
      .clone()
      .resize(300, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbnailPath),
    pipeline
      .clone()
      .resize(400, 400, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);

  try { fs.unlinkSync(file.path); } catch { /* ignore */ }

  let hasAvif = 0;
  try {
    await Promise.all([
      encodeAvif(webpPath, path.join(mediumsDir, avifCompanion(mediumName)), 1200),
      encodeAvif(thumbnailPath, path.join(thumbnailsDir, avifCompanion(thumbnailName)), 300),
    ]);
    hasAvif = 1;
  } catch (err) {
    console.warn('AVIF encode failed:', err.message);
  }

  const analysis = analyzeRgba(sample.data, sample.info.channels || 4);
  const rotation = (Math.random() * 6 - 3).toFixed(1);

  let photoDate = date;
  if (!photoDate && formattedExif.dateTime) {
    photoDate = formattedExif.dateTime;
  } else if (!photoDate) {
    const stats = fs.statSync(webpPath);
    photoDate = stats.mtime.toISOString().split('T')[0];
  }

  return {
    title: title || path.parse(file.originalname).name || '未命名',
    filename: webpFilename,
    thumbnail: thumbnailName,
    medium: mediumName,
    width: fullInfo.width || null,
    height: fullInfo.height || null,
    histogram: JSON.stringify(analysis.histogram),
    palette: JSON.stringify(analysis.palette),
    hasAvif,
    date: photoDate,
    category: category || null,
    rotation: parseFloat(rotation),
    cameraMake: formattedExif.make,
    cameraModel: formattedExif.model,
    exposureTime: formattedExif.exposureTime,
    fNumber: formattedExif.fNumber,
    iso: formattedExif.iso,
    focalLength: formattedExif.focalLength,
    software: formattedExif.software,
    lensModel: formattedExif.lensModel,
    whiteBalance: formattedExif.whiteBalance,
    meteringMode: formattedExif.meteringMode,
    exposureBias: formattedExif.exposureBias,
    flash: formattedExif.flash,
    colorSpace: formattedExif.colorSpace,
    latitude: null,
    longitude: null,
    altitude: null,
  };
}

function insertPhotoRow(db, photoData, uploadedBy, reviewStatus) {
  db.run(
    `INSERT INTO photos (title, filename, thumbnail, medium, width, height, histogram, palette, has_avif, date, category, rotation,
     camera_make, camera_model, exposure_time, f_number, iso, focal_length,
     software, lens_model, white_balance, metering_mode, exposure_bias, flash, color_space,
     latitude, longitude, altitude, uploaded_by, review_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      photoData.title, photoData.filename, photoData.thumbnail, photoData.medium,
      photoData.width, photoData.height, photoData.histogram, photoData.palette, photoData.hasAvif || 0,
      photoData.date, photoData.category, photoData.rotation,
      photoData.cameraMake, photoData.cameraModel, photoData.exposureTime,
      photoData.fNumber, photoData.iso, photoData.focalLength,
      photoData.software, photoData.lensModel, photoData.whiteBalance,
      photoData.meteringMode, photoData.exposureBias, photoData.flash, photoData.colorSpace,
      photoData.latitude, photoData.longitude, photoData.altitude,
      uploadedBy, reviewStatus,
    ]
  );
}

function unlinkPhotoFiles(photo) {
  const names = [
    [uploadsDir, photo.filename],
    [thumbnailsDir, photo.thumbnail],
    [thumbnailsDir, avifCompanion(photo.thumbnail)],
    [mediumsDir, photo.medium],
    [mediumsDir, avifCompanion(photo.medium)],
  ];
  for (const [dir, name] of names) {
    if (!name) continue;
    const target = path.join(dir, name);
    try { if (fs.existsSync(target)) fs.unlinkSync(target); } catch { /* ignore */ }
  }
}

function parseJsonField(value) {
  if (!value || typeof value !== 'string') return value || null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function hydrateDetail(photo) {
  return {
    ...photo,
    histogram: parseJsonField(photo.histogram),
    palette: parseJsonField(photo.palette) || [],
  };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// GET /api/photos/random - Get random photos for homepage
router.get('/random', (req, res) => {
  try {
    const db = getDb();
    const count = parseInt(req.query.count) || 20;
    
    // Get total count
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM photos');
    countStmt.step();
    const total = countStmt.getAsObject().total;
    countStmt.free();
    
    if (total === 0) {
      return paginate(res, [], { total: 0, count: 0 });
    }

    const idStmt = db.prepare('SELECT id FROM photos WHERE review_status = 1');
    const ids = [];
    while (idStmt.step()) {
      ids.push(idStmt.getAsObject().id);
    }
    idStmt.free();

    if (ids.length === 0) {
      return paginate(res, [], { total, count: 0 });
    }

    const actualCount = Math.min(count, ids.length);
    for (let i = 0; i < actualCount; i++) {
      const j = i + Math.floor(Math.random() * (ids.length - i));
      const tmp = ids[i];
      ids[i] = ids[j];
      ids[j] = tmp;
    }
    const picked = ids.slice(0, actualCount);
    const placeholders = picked.map(() => '?').join(',');
    const stmt = db.prepare(`
      SELECT ${LIST_FIELDS}
      FROM photos p
      LEFT JOIN users u ON p.uploaded_by = u.username
      WHERE p.id IN (${placeholders})
    `);
    stmt.bind(picked);

    const byId = new Map();
    while (stmt.step()) {
      const row = stmt.getAsObject();
      byId.set(row.id, row);
    }
    stmt.free();

    const photos = picked.map((id) => byId.get(id)).filter(Boolean);

    paginate(res, photos, { total, count: photos.length }, '获取成功');
  } catch (err) {
    console.error('Get random photos error:', err);
    error(res, '获取随机照片失败');
  }
});

// GET /api/photos - with search and pagination
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const { category, title, dateFrom, dateTo, page = 1, pageSize = 20, scope } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    // scope=all: show all approved photos (for portfolio)
    // default: non-admin users only see their own photos (for admin page)
    if (scope !== 'all' && req.user && req.user.role !== 'admin') {
      whereConditions.push('p.uploaded_by = ?');
      params.push(req.user.username);
    }
    
    // Non-admin always see only approved photos
    if (req.user && req.user.role !== 'admin') {
      whereConditions.push('p.review_status = 1');
    }
    
    if (category) {
      whereConditions.push('p.category = ?');
      params.push(category);
    }
    
    if (title) {
      whereConditions.push('p.title LIKE ?');
      params.push(`%${title}%`);
    }
    
    if (dateFrom) {
      whereConditions.push('p.date >= ?');
      params.push(dateFrom);
    }
    
    if (dateTo) {
      whereConditions.push('p.date <= ?');
      params.push(dateTo);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';
    
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM photos p ${whereClause}`);
    if (params.length > 0) countStmt.bind(params);
    countStmt.step();
    const total = countStmt.getAsObject().total;
    countStmt.free();
    
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const dataStmt = db.prepare(
      `SELECT ${LIST_FIELDS}
       FROM photos p
       LEFT JOIN users u ON p.uploaded_by = u.username
       ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    );
    dataStmt.bind([...params, parseInt(pageSize), offset]);
    
    const photos = [];
    while (dataStmt.step()) {
      photos.push(dataStmt.getAsObject());
    }
    dataStmt.free();
    
    paginate(res, photos, {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      totalPages: Math.ceil(total / parseInt(pageSize))
    });
  } catch (err) {
    console.error('Get photos error:', err);
    error(res, '获取照片列表失败');
  }
});

// DELETE /api/photos/batch - Batch delete
router.post('/batch-delete', authMiddleware, requireMenu('admin'), (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return error(res, '请选择要删除的照片', 400);
    }

    const db = getDb();
    let deletedCount = 0;

    for (const id of ids) {
      const stmt = db.prepare('SELECT * FROM photos WHERE id = ?');
      stmt.bind([parseInt(id)]);
      if (stmt.step()) {
        const photo = stmt.getAsObject();
        // Permission: non-admin users can only delete their own photos
        if (req.user.role !== 'admin' && photo.uploaded_by !== req.user.username) {
          stmt.free();
          continue;
        }
        unlinkPhotoFiles(photo);
        db.run('DELETE FROM photos WHERE id = ?', [parseInt(id)]);
        deletedCount++;
      }
      stmt.free();
    }

    saveDb();
    success(res, { deletedCount }, `成功删除 ${deletedCount} 张照片`);
  } catch (err) {
    console.error('Batch delete error:', err);
    error(res, '批量删除失败: ' + err.message);
  }
});

// GET /api/photos/review - List all photos for review (module_admin+)
router.get('/review', authMiddleware, requireMenu('review'), (req, res) => {
  try {
    const db = getDb();
    const { review_status, page = 1, pageSize = 20 } = req.query;

    let whereConditions = [];
    let params = [];

    if (review_status !== undefined && review_status !== '') {
      whereConditions.push('p.review_status = ?');
      params.push(parseInt(review_status));
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM photos p ${whereClause}`);
    if (params.length > 0) countStmt.bind(params);
    countStmt.step();
    const total = countStmt.getAsObject().total;
    countStmt.free();

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const dataStmt = db.prepare(
      `SELECT ${LIST_FIELDS}
       FROM photos p
       LEFT JOIN users u ON p.uploaded_by = u.username
       ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    );
    dataStmt.bind([...params, parseInt(pageSize), offset]);

    const photos = [];
    while (dataStmt.step()) {
      photos.push(dataStmt.getAsObject());
    }
    dataStmt.free();

    paginate(res, photos, { page: parseInt(page), pageSize: parseInt(pageSize), total, totalPages: Math.ceil(total / parseInt(pageSize)) });
  } catch (err) {
    console.error('Get review photos error:', err);
    error(res, '获取审核列表失败');
  }
});

// PUT /api/photos/batch-review - Batch approve/reject
router.post('/batch-review', authMiddleware, requireMenu('review'), (req, res) => {
  try {
    const { ids, review_status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return error(res, '请选择照片', 400);
    }
    if (![1, 2].includes(review_status)) {
      return error(res, '无效的审核状态', 400);
    }

    const db = getDb();
    for (const id of ids) {
      db.run('UPDATE photos SET review_status = ? WHERE id = ?', [review_status, parseInt(id)]);
    }
    saveDb();

    success(res, { count: ids.length }, review_status === 1 ? `已通过 ${ids.length} 张照片` : `已拒绝 ${ids.length} 张照片`);
  } catch (err) {
    console.error('Batch review error:', err);
    error(res, '批量审核失败');
  }
});

function visibilitySql(user) {
  if (user?.role === 'admin' || hasMenu(user, 'review')) {
    return { sql: '1=1', params: [] };
  }
  if (user) {
    return { sql: '(review_status = 1 OR uploaded_by = ?)', params: [user.username] };
  }
  return { sql: 'review_status = 1', params: [] };
}

// GET /api/photos/:id
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const photoId = parseInt(req.params.id);
    const stmt = db.prepare(`
      SELECT p.*, u.display_name AS uploader_display_name, u.avatar AS uploader_avatar, u.bio AS uploader_bio
      FROM photos p
      LEFT JOIN users u ON p.uploaded_by = u.username
      WHERE p.id = ?
    `);
    stmt.bind([photoId]);

    if (stmt.step()) {
      const photo = stmt.getAsObject();
      stmt.free();

      if (!canViewPhoto(req.user, photo)) {
        return error(res, '照片不存在', 404);
      }

      const vis = visibilitySql(req.user);
      const prevStmt = db.prepare(`SELECT id FROM photos WHERE id < ? AND ${vis.sql} ORDER BY id DESC LIMIT 1`);
      prevStmt.bind([photoId, ...vis.params]);
      const prevId = prevStmt.step() ? prevStmt.getAsObject().id : null;
      prevStmt.free();

      const nextStmt = db.prepare(`SELECT id FROM photos WHERE id > ? AND ${vis.sql} ORDER BY id ASC LIMIT 1`);
      nextStmt.bind([photoId, ...vis.params]);
      const nextId = nextStmt.step() ? nextStmt.getAsObject().id : null;
      nextStmt.free();

      success(res, { ...hydrateDetail(photo), prev_id: prevId, next_id: nextId });
    } else {
      stmt.free();
      error(res, '照片不存在', 404);
    }
  } catch (err) {
    console.error('Get photo error:', err);
    error(res, '获取照片失败');
  }
});

// POST /api/photos - Single upload
router.post('/', authMiddleware, requireMenu('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请选择要上传的文件', 400);
    }

    const { title, date, category } = req.body;
    const photoData = await processPhoto(req.file, title, date, category);
    const uploadedBy = req.user ? req.user.username : null;
    // Admin uploads auto-approved, others pending
    const reviewStatus = req.user?.role === 'admin' ? 1 : 0;

    const db = getDb();
    insertPhotoRow(db, photoData, uploadedBy, reviewStatus);
    saveDb();

    const stmt = db.prepare('SELECT * FROM photos WHERE id = last_insert_rowid()');
    stmt.step();
    const photo = stmt.getAsObject();
    stmt.free();

    success(res, hydrateDetail(photo), '上传成功', 201);
  } catch (err) {
    console.error('Upload error:', err);
    error(res, '上传失败: ' + err.message);
  }
});

// POST /api/photos/batch - Batch upload
router.post('/batch', authMiddleware, requireMenu('admin'), upload.array('files', 100), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return error(res, '请选择要上传的文件', 400);
    }

    const { category } = req.body;
    const db = getDb();
    const results = [];
    let successCount = 0;
    let failCount = 0;
    const uploadedBy = req.user ? req.user.username : null;
    const reviewStatus = req.user?.role === 'admin' ? 1 : 0;

    const processed = await mapLimit(req.files, 3, async (file) => {
      try {
        const photoData = await processPhoto(file, null, null, category);
        return { ok: true, file, photoData };
      } catch (err) {
        console.error(`Error processing ${file.originalname}:`, err);
        return { ok: false, file, error: err.message };
      }
    });

    for (const item of processed) {
      if (!item.ok) {
        results.push({ success: false, filename: item.file.originalname, error: item.error });
        failCount++;
        continue;
      }
      insertPhotoRow(db, item.photoData, uploadedBy, reviewStatus);
      results.push({ success: true, filename: item.file.originalname });
      successCount++;
    }

    saveDb();

    success(res, {
      successCount,
      failCount,
      results
    }, `上传完成：成功 ${successCount} 张${failCount > 0 ? `，失败 ${failCount} 张` : ''}`, 201);
  } catch (err) {
    console.error('Batch upload error:', err);
    error(res, '批量上传失败: ' + err.message);
  }
});

// PUT /api/photos/:id
router.put('/:id', authMiddleware, requireMenu('admin'), (req, res) => {
  try {
    const db = getDb();
    const { title, date, category } = req.body;
    
    const checkStmt = db.prepare('SELECT * FROM photos WHERE id = ?');
    checkStmt.bind([parseInt(req.params.id)]);
    
    if (!checkStmt.step()) {
      checkStmt.free();
      return error(res, '照片不存在', 404);
    }
    
    const existing = checkStmt.getAsObject();
    checkStmt.free();
    
    // Permission: non-admin users can only edit their own photos
    if (req.user.role !== 'admin' && existing.uploaded_by !== req.user.username) {
      return error(res, '无权编辑此照片', 403);
    }
    
    db.run(
      'UPDATE photos SET title = ?, date = ?, category = ? WHERE id = ?',
      [
        title || existing.title,
        date || existing.date,
        category || existing.category,
        parseInt(req.params.id)
      ]
    );
    saveDb();
    
    const stmt = db.prepare('SELECT * FROM photos WHERE id = ?');
    stmt.bind([parseInt(req.params.id)]);
    stmt.step();
    const photo = stmt.getAsObject();
    stmt.free();
    
    success(res, photo, '更新成功');
  } catch (err) {
    console.error('Update error:', err);
    error(res, '更新失败: ' + err.message);
  }
});

// DELETE /api/photos/:id
router.delete('/:id', authMiddleware, requireMenu('admin'), (req, res) => {
  try {
    const db = getDb();
    
    const checkStmt = db.prepare('SELECT * FROM photos WHERE id = ?');
    checkStmt.bind([parseInt(req.params.id)]);
    
    if (!checkStmt.step()) {
      checkStmt.free();
      return error(res, '照片不存在', 404);
    }
    
    const photo = checkStmt.getAsObject();
    checkStmt.free();
    
    // Permission: non-admin users can only delete their own photos
    if (req.user.role !== 'admin' && photo.uploaded_by !== req.user.username) {
      return error(res, '无权删除此照片', 403);
    }
    
    unlinkPhotoFiles(photo);

    db.run('DELETE FROM photos WHERE id = ?', [parseInt(req.params.id)]);
    saveDb();
    
    success(res, null, '删除成功');
  } catch (err) {
    console.error('Delete error:', err);
    error(res, '删除失败: ' + err.message);
  }
});

// PUT /api/photos/:id/review - Approve or reject a photo
router.put('/:id/review', authMiddleware, requireMenu('review'), (req, res) => {
  try {
    const { review_status } = req.body;
    if (![1, 2].includes(review_status)) {
      return error(res, '无效的审核状态', 400);
    }

    const db = getDb();
    const checkStmt = db.prepare('SELECT id FROM photos WHERE id = ?');
    checkStmt.bind([parseInt(req.params.id)]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return error(res, '照片不存在', 404);
    }
    checkStmt.free();

    db.run('UPDATE photos SET review_status = ? WHERE id = ?', [review_status, parseInt(req.params.id)]);
    saveDb();

    success(res, null, review_status === 1 ? '已通过审核' : '已拒绝');
  } catch (err) {
    console.error('Review error:', err);
    error(res, '审核操作失败');
  }
});

module.exports = router;

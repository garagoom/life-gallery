const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const exifReader = require('exif-reader');
const { getDb, saveDb } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { requireEditor } = require('../middleware/permission.cjs');

const router = express.Router();

// Ensure directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const thumbnailsDir = path.join(__dirname, '..', 'thumbnails');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(thumbnailsDir, { recursive: true });

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

// Extract EXIF data from image
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
      whiteBalance: photo.WhiteBalance || exifIFD.WhiteBalance || null,
      meteringMode: photo.MeteringMode || exifIFD.MeteringMode || null,
      flash: photo.Flash || exifIFD.Flash || null,
      colorSpace: photo.ColorSpace || exifIFD.ColorSpace || null,
    };
  } catch (error) {
    console.error('EXIF extraction error:', error);
    return {
      make: null, model: null, exposureTime: null, fNumber: null,
      iso: null, focalLength: null, dateTime: null, width: null,
      height: null, software: null, lensModel: null, whiteBalance: null,
      meteringMode: null, flash: null, colorSpace: null,
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
    whiteBalance: exif.whiteBalance,
    meteringMode: exif.meteringMode,
    flash: exif.flash,
    colorSpace: exif.colorSpace,
  };
}

// Process and save a single photo file
async function processPhoto(file, title, date, category) {
  // New filename as .webp
  const baseName = path.parse(file.filename).name;
  const webpFilename = baseName + '.webp';
  const webpPath = path.join(uploadsDir, webpFilename);
  const thumbnailName = 'thumb-' + baseName + '.webp';
  const thumbnailPath = path.join(thumbnailsDir, thumbnailName);

  // Extract EXIF before conversion
  const exif = await extractExif(file.path);
  const formattedExif = formatExif(exif);

  // Convert original to WebP, limit max width to 3840px (4K)
  // rotate() without args auto-rotates based on EXIF orientation
  await sharp(file.path)
    .rotate()
    .resize(3840, null, { withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(webpPath);

  // Delete original file
  try { fs.unlinkSync(file.path); } catch (e) { /* ignore */ }

  // Generate thumbnail as WebP, 300px wide
  await sharp(webpPath)
    .rotate()
    .resize(300, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(thumbnailPath);

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
    flash: formattedExif.flash,
    colorSpace: formattedExif.colorSpace,
  };
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
    
    // Get random photos using ORDER BY RANDOM()
    const actualCount = Math.min(count, total);
    const stmt = db.prepare(`SELECT * FROM photos ORDER BY RANDOM() LIMIT ?`);
    stmt.bind([actualCount]);
    
    const photos = [];
    while (stmt.step()) {
      photos.push(stmt.getAsObject());
    }
    stmt.free();
    
    paginate(res, photos, { total, count: photos.length }, '获取成功');
  } catch (err) {
    console.error('Get random photos error:', err);
    error(res, '获取随机照片失败');
  }
});

// GET /api/photos - with search and pagination
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { category, title, dateFrom, dateTo, page = 1, pageSize = 20 } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (category) {
      whereConditions.push('category = ?');
      params.push(category);
    }
    
    if (title) {
      whereConditions.push('title LIKE ?');
      params.push(`%${title}%`);
    }
    
    if (dateFrom) {
      whereConditions.push('date >= ?');
      params.push(dateFrom);
    }
    
    if (dateTo) {
      whereConditions.push('date <= ?');
      params.push(dateTo);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';
    
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM photos ${whereClause}`);
    if (params.length > 0) countStmt.bind(params);
    countStmt.step();
    const total = countStmt.getAsObject().total;
    countStmt.free();
    
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const dataStmt = db.prepare(
      `SELECT * FROM photos ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
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

// GET /api/photos/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM photos WHERE id = ?');
    stmt.bind([parseInt(req.params.id)]);
    
    if (stmt.step()) {
      const photo = stmt.getAsObject();
      stmt.free();

      // Get prev/next IDs for navigation
      const prevStmt = db.prepare('SELECT id FROM photos WHERE id < ? ORDER BY id DESC LIMIT 1');
      prevStmt.bind([parseInt(req.params.id)]);
      const prevId = prevStmt.step() ? prevStmt.getAsObject().id : null;
      prevStmt.free();

      const nextStmt = db.prepare('SELECT id FROM photos WHERE id > ? ORDER BY id ASC LIMIT 1');
      nextStmt.bind([parseInt(req.params.id)]);
      const nextId = nextStmt.step() ? nextStmt.getAsObject().id : null;
      nextStmt.free();

      success(res, { ...photo, prev_id: prevId, next_id: nextId });
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
router.post('/', authMiddleware, requireEditor, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请选择要上传的文件', 400);
    }

    const { title, date, category } = req.body;
    const photoData = await processPhoto(req.file, title, date, category);
    const uploadedBy = req.user ? req.user.username : null;

    const db = getDb();
    db.run(
      `INSERT INTO photos (title, filename, thumbnail, date, category, rotation, 
       camera_make, camera_model, exposure_time, f_number, iso, focal_length,
       software, lens_model, white_balance, metering_mode, flash, color_space, uploaded_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        photoData.title, photoData.filename, photoData.thumbnail,
        photoData.date, photoData.category, photoData.rotation,
        photoData.cameraMake, photoData.cameraModel, photoData.exposureTime,
        photoData.fNumber, photoData.iso, photoData.focalLength,
        photoData.software, photoData.lensModel, photoData.whiteBalance,
        photoData.meteringMode, photoData.flash, photoData.colorSpace, uploadedBy,
      ]
    );
    saveDb();

    const stmt = db.prepare('SELECT * FROM photos WHERE id = last_insert_rowid()');
    stmt.step();
    const photo = stmt.getAsObject();
    stmt.free();

    success(res, photo, '上传成功', 201);
  } catch (err) {
    console.error('Upload error:', err);
    error(res, '上传失败: ' + err.message);
  }
});

// POST /api/photos/batch - Batch upload
router.post('/batch', authMiddleware, requireEditor, upload.array('files', 100), async (req, res) => {
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

    for (const file of req.files) {
      try {
        const photoData = await processPhoto(file, null, null, category);

        db.run(
          `INSERT INTO photos (title, filename, thumbnail, date, category, rotation,
           camera_make, camera_model, exposure_time, f_number, iso, focal_length,
           software, lens_model, white_balance, metering_mode, flash, color_space, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            photoData.title, photoData.filename, photoData.thumbnail,
            photoData.date, photoData.category, photoData.rotation,
            photoData.cameraMake, photoData.cameraModel, photoData.exposureTime,
            photoData.fNumber, photoData.iso, photoData.focalLength,
            photoData.software, photoData.lensModel, photoData.whiteBalance,
            photoData.meteringMode, photoData.flash, photoData.colorSpace, uploadedBy,
          ]
        );

        results.push({ success: true, filename: file.originalname });
        successCount++;
      } catch (err) {
        console.error(`Error processing ${file.originalname}:`, err);
        results.push({ success: false, filename: file.originalname, error: err.message });
        failCount++;
      }
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
router.put('/:id', authMiddleware, requireEditor, (req, res) => {
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
router.delete('/:id', authMiddleware, requireEditor, (req, res) => {
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
    
    const uploadPath = path.join(uploadsDir, photo.filename);
    const thumbPath = path.join(thumbnailsDir, photo.thumbnail);
    
    if (fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    
    db.run('DELETE FROM photos WHERE id = ?', [parseInt(req.params.id)]);
    saveDb();
    
    success(res, null, '删除成功');
  } catch (err) {
    console.error('Delete error:', err);
    error(res, '删除失败: ' + err.message);
  }
});

// DELETE /api/photos/batch - Batch delete
router.post('/batch-delete', authMiddleware, requireEditor, (req, res) => {
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
        const uploadPath = path.join(uploadsDir, photo.filename);
        const thumbPath = path.join(thumbnailsDir, photo.thumbnail);
        try { if (fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath); } catch (e) {}
        try { if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath); } catch (e) {}
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

module.exports = router;

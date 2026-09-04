const path = require('path');
const fs = require('fs');
const { getDb } = require('../db.cjs');
const { hasMenu } = require('./permission.cjs');
const { lookupName } = require('../lib/photoDerivatives.cjs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const thumbnailsDir = path.join(__dirname, '..', 'thumbnails');
const mediumsDir = path.join(__dirname, '..', 'mediums');

const KIND_CONFIG = {
  filename: { dir: uploadsDir, column: 'filename' },
  thumbnail: { dir: thumbnailsDir, column: 'thumbnail' },
  medium: { dir: mediumsDir, column: 'medium' },
};

function safeFile(dir, name) {
  const base = path.basename(name || '');
  if (!base || base !== name) return null;
  const full = path.resolve(dir, base);
  if (!full.startsWith(path.resolve(dir) + path.sep) && full !== path.resolve(dir)) {
    return null;
  }
  return { base, full };
}

function canViewPhoto(user, photo) {
  if (!photo) return false;
  if (Number(photo.review_status) === 1) return true;
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (photo.uploaded_by && photo.uploaded_by === user.username) return true;
  return hasMenu(user, 'review');
}

function lookupPhotoByFile(kind, filename) {
  const config = KIND_CONFIG[kind];
  if (!config) return null;
  const db = getDb();
  const stmt = db.prepare(
    `SELECT id, filename, thumbnail, medium, review_status, uploaded_by FROM photos WHERE ${config.column} = ?`
  );
  stmt.bind([lookupName(filename)]);
  const photo = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return photo;
}

function sendMedia(req, res, kind) {
  const config = KIND_CONFIG[kind];
  if (!config) {
    return res.status(404).end();
  }
  const parsed = safeFile(config.dir, req.params.filename);
  if (!parsed) {
    return res.status(404).end();
  }

  const photo = lookupPhotoByFile(kind, parsed.base);
  if (!photo || !canViewPhoto(req.user, photo)) {
    return res.status(404).end();
  }

  if (!fs.existsSync(parsed.full)) {
    return res.status(404).end();
  }

  const approved = Number(photo.review_status) === 1;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (approved) {
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  } else {
    res.setHeader('Cache-Control', 'private, no-store');
  }
  return res.sendFile(parsed.full);
}

function serveUpload(req, res) {
  sendMedia(req, res, 'filename');
}

function serveThumbnail(req, res) {
  sendMedia(req, res, 'thumbnail');
}

function serveMedium(req, res) {
  sendMedia(req, res, 'medium');
}

module.exports = { serveUpload, serveThumbnail, serveMedium, canViewPhoto };

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

export function isImageFile(file) {
  if (!file) return false;
  const mime = String(file.type || file.mimetype || '').toLowerCase();
  const name = file.name || file.originalname || '';
  if (ALLOWED_MIME.has(mime)) return true;
  if (mime.startsWith('image/') && ALLOWED_EXT.test(name)) return true;
  if ((!mime || mime === 'application/octet-stream') && ALLOWED_EXT.test(name)) return true;
  return false;
}

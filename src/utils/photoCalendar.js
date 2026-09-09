import dayjs from 'dayjs';

/** 拍摄日期：photos.date（上传时由 EXIF DateTimeOriginal 写入） */
export function photoDateKey(photo) {
  const raw = photo?.date;
  if (!raw || typeof raw !== 'string') return null;

  const normalized = raw.includes(':') && !raw.includes('-')
    ? raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
    : raw;

  const date = dayjs(normalized);
  return date.isValid() ? date.format('YYYY-MM-DD') : null;
}

export function groupPhotosByDate(photos) {
  const map = {};
  photos.forEach((photo) => {
    const key = photoDateKey(photo);
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(photo);
  });
  return map;
}

export function latestShootMonth(photos) {
  let latest = null;
  photos.forEach((photo) => {
    const key = photoDateKey(photo);
    if (!key) return;
    const date = dayjs(key);
    if (!latest || date.isAfter(latest)) latest = date;
  });
  return latest ? latest.startOf('month') : null;
}

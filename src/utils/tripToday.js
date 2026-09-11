const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function isIsoDate(value) {
  return ISO_DATE.test(String(value || ''));
}

export function todayInShanghai(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function formatTripDayDate(iso) {
  if (!isIsoDate(iso)) return '';
  const [year, month, day] = String(iso).split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${month}月${day}日 周${weekday}`;
}

export function shortTripDayDate(iso) {
  if (!isIsoDate(iso)) return '';
  const [, month, day] = String(iso).split('-').map(Number);
  return `${month}/${day}`;
}

export function pickTodayTripDay(days = [], today = todayInShanghai(), startDate = '') {
  const list = Array.isArray(days) ? days : [];
  const byDate = list.find((day) => isIsoDate(day?.date) && day.date === today);
  if (byDate) return byDate;
  if (!isIsoDate(startDate) || today < startDate) return null;
  const start = Date.parse(`${startDate}T00:00:00`);
  const current = Date.parse(`${today}T00:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(current)) return null;
  const offset = Math.round((current - start) / 86400000);
  if (offset < 0) return null;
  const byIndex = list.find((day) => Number(day.day_index) === offset + 1);
  if (byIndex) return byIndex;
  return list[offset] || null;
}

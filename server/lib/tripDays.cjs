function addUtcDays(iso, n) {
  const [year, month, day] = String(iso).split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + n));
  return dt.toISOString().slice(0, 10);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function buildDaysFromRange(startDate, endDate) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || endDate < startDate) return [];
  const days = [];
  let index = 0;
  let current = startDate;
  while (current <= endDate) {
    days.push({
      day_index: index + 1,
      date: current,
      title: '',
      lodging: '',
      notes: '',
      sort_order: index,
    });
    index += 1;
    if (index > 366) break;
    current = addUtcDays(startDate, index);
  }
  return days;
}

module.exports = { addUtcDays, isIsoDate, buildDaysFromRange };

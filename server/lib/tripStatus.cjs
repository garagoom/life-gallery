const { isIsoDate } = require('./tripDays.cjs');

function todayInShanghai(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function tripDateRange(trip = {}) {
  const start = isIsoDate(trip.start_date) ? trip.start_date : '';
  const end = isIsoDate(trip.end_date) ? trip.end_date : '';
  return {
    start: start || end,
    end: end || start,
  };
}

function nextAutoTripStatus(trip = {}, today = todayInShanghai()) {
  const status = String(trip.status || '');
  const { start, end } = tripDateRange(trip);
  if (!start && !end) return status || trip.status;
  if (status === 'planning' && start && today >= start) return 'cancelled';
  if (status !== 'upcoming' && status !== 'ongoing') return status || trip.status;
  if (end && today > end) return 'completed';
  if (status === 'upcoming' && start && today >= start && (!end || today <= end)) return 'ongoing';
  return status;
}

function rowsChanged(database) {
  const result = database.exec('SELECT changes() AS n');
  return Number(result?.[0]?.values?.[0]?.[0] || 0);
}

function syncTripStatuses(database, today = todayInShanghai()) {
  database.run(
    `UPDATE trips
     SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'planning'
       AND IFNULL(NULLIF(start_date, ''), end_date) != ''
       AND IFNULL(NULLIF(start_date, ''), end_date) <= ?`,
    [today]
  );
  let changed = rowsChanged(database);
  database.run(
    `UPDATE trips
     SET status = 'completed', updated_at = CURRENT_TIMESTAMP
     WHERE status IN ('upcoming', 'ongoing')
       AND IFNULL(end_date, '') != ''
       AND end_date < ?`,
    [today]
  );
  changed += rowsChanged(database);
  database.run(
    `UPDATE trips
     SET status = 'ongoing', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'upcoming'
       AND IFNULL(start_date, '') != ''
       AND start_date <= ?
       AND IFNULL(NULLIF(end_date, ''), start_date) >= ?`,
    [today, today]
  );
  return changed + rowsChanged(database);
}

module.exports = {
  todayInShanghai,
  nextAutoTripStatus,
  syncTripStatuses,
};

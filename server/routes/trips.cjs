const express = require('express');
const { getDb, saveDb } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const {
  requireMenu,
  requireAnyMenu,
  buildTripListFilter,
  canReadTrip,
  canWriteTrip,
} = require('../middleware/permission.cjs');
const { buildDaysFromRange, isIsoDate } = require('../lib/tripDays.cjs');
const { syncTripStatuses } = require('../lib/tripStatus.cjs');

const router = express.Router();

const TRIP_STATUSES = new Set(['planning', 'upcoming', 'ongoing', 'completed', 'cancelled']);

function success(res, data, message = 'success', code = 200) {
  return res.status(code).json({ code, message, data });
}

function error(res, message = '操作失败', code = 500) {
  return res.status(code).json({ code, message, data: null });
}

function paginate(res, data, pagination, message = 'success') {
  return res.status(200).json({ code: 200, message, data, pagination });
}

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function lastInsertId(db) {
  return queryOne(db, 'SELECT last_insert_rowid() as id').id;
}

function normalizeStatus(value, fallback = 'planning') {
  const status = String(value || fallback);
  return TRIP_STATUSES.has(status) ? status : fallback;
}

function normalizePartySize(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function getTrip(db, id) {
  return queryOne(db, 'SELECT * FROM trips WHERE id = ?', [id]);
}

function getDays(db, tripId) {
  return queryAll(
    db,
    'SELECT * FROM trip_days WHERE trip_id = ? ORDER BY sort_order ASC, day_index ASC, id ASC',
    [tripId]
  );
}

function getLinkedBudget(db, tripId) {
  return queryOne(db, 'SELECT id, title FROM budgets WHERE trip_id = ?', [tripId]);
}

function presentTrip(trip, extras = {}) {
  return {
    ...trip,
    party_size: Number(trip.party_size) || 1,
    ...extras,
  };
}

function presentTripDetail(trip) {
  const db = getDb();
  return presentTrip(trip, {
    days: getDays(db, trip.id),
    budget: getLinkedBudget(db, trip.id),
  });
}

function insertGeneratedDays(db, tripId, startDate, endDate) {
  const days = buildDaysFromRange(startDate, endDate);
  for (const day of days) {
    db.run(
      `INSERT INTO trip_days (trip_id, day_index, date, title, lodging, notes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tripId, day.day_index, day.date, day.title, day.lodging, day.notes, day.sort_order]
    );
  }
  return days.length;
}

function attachBudgets(trips) {
  const db = getDb();
  return trips.map((trip) => presentTrip(trip, {
    budget: getLinkedBudget(db, trip.id),
  }));
}

function parseTripPayload(body = {}, { partial = false } = {}) {
  const payload = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) {
      const err = new Error('请填写出游标题');
      err.statusCode = 400;
      throw err;
    }
    payload.title = title;
  }
  if (!partial || body.destination !== undefined) payload.destination = body.destination == null ? '' : String(body.destination).trim();
  if (!partial || body.start_date !== undefined) {
    payload.start_date = body.start_date && isIsoDate(body.start_date) ? body.start_date : null;
  }
  if (!partial || body.end_date !== undefined) {
    payload.end_date = body.end_date && isIsoDate(body.end_date) ? body.end_date : null;
  }
  if (!partial || body.status !== undefined) payload.status = normalizeStatus(body.status);
  if (!partial || body.summary !== undefined) payload.summary = body.summary == null ? '' : String(body.summary);
  if (!partial || body.party_size !== undefined) payload.party_size = normalizePartySize(body.party_size);
  payload.visibility = 'private';
  if (!partial || body.cover_url !== undefined) payload.cover_url = body.cover_url == null ? '' : String(body.cover_url);
  return payload;
}

function forbidIfCannotWrite(req, res, trip) {
  if (!canWriteTrip(req.user, trip)) {
    error(res, '权限不足', 403);
    return true;
  }
  return false;
}

function refreshTripStatuses(db) {
  if (syncTripStatuses(db)) saveDb();
}

function loadAccessibleTrip(req, res) {
  const db = getDb();
  const trip = getTrip(db, req.params.id);
  if (!trip) {
    error(res, '出游计划不存在', 404);
    return null;
  }
  if (!canReadTrip(req.user, trip)) {
    error(res, '权限不足', 403);
    return null;
  }
  return trip;
}

router.get('/', authMiddleware, requireAnyMenu('travel_trips', 'travel_budget', 'travel_shopping'), (req, res) => {
  try {
    const db = getDb();
    refreshTripStatuses(db);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const listFilter = buildTripListFilter(req.user);
    const where = [listFilter.sql];
    const params = [...listFilter.params];

    if (req.query.title) {
      where.push('title LIKE ?');
      params.push(`%${req.query.title}%`);
    }
    if (req.query.destination) {
      where.push('destination LIKE ?');
      params.push(`%${req.query.destination}%`);
    }
    if (req.query.status && TRIP_STATUSES.has(String(req.query.status))) {
      where.push('status = ?');
      params.push(req.query.status);
    }
    if (req.query.dateFrom) {
      where.push('start_date >= ?');
      params.push(req.query.dateFrom);
    }
    if (req.query.dateTo) {
      where.push('end_date <= ?');
      params.push(req.query.dateTo);
    }
    if (req.query.unlinked === '1' || req.query.unlinked === 'true') {
      where.push('id NOT IN (SELECT trip_id FROM budgets WHERE trip_id IS NOT NULL)');
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;
    const total = queryOne(db, `SELECT COUNT(*) as total FROM trips ${whereClause}`, params).total;
    const offset = (page - 1) * pageSize;
    const trips = queryAll(
      db,
      `SELECT * FROM trips ${whereClause} ORDER BY start_date DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    paginate(res, attachBudgets(trips), {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error('List trips error:', err);
    error(res, '获取出游计划失败');
  }
});

router.post('/', authMiddleware, requireMenu('travel_trips'), (req, res) => {
  try {
    if (!canWriteTrip(req.user, { created_by: req.user.username })) {
      return error(res, '权限不足', 403);
    }
    const payload = parseTripPayload(req.body);
    const db = getDb();
    db.run(
      `INSERT INTO trips (
        title, destination, start_date, end_date, status, summary, party_size,
        visibility, cover_url, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.title,
        payload.destination,
        payload.start_date,
        payload.end_date,
        payload.status,
        payload.summary,
        payload.party_size,
        payload.visibility,
        payload.cover_url,
        req.user.username,
      ]
    );
    const id = lastInsertId(db);
    insertGeneratedDays(db, id, payload.start_date, payload.end_date);
    saveDb();
    success(res, presentTripDetail(getTrip(db, id)), '创建成功', 201);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    console.error('Create trip error:', err);
    error(res, '创建出游计划失败');
  }
});

router.get('/:id', authMiddleware, requireAnyMenu('travel_trips', 'travel_budget', 'travel_shopping'), (req, res) => {
  try {
    const trip = loadAccessibleTrip(req, res);
    if (!trip) return;
    const db = getDb();
    refreshTripStatuses(db);
    success(res, presentTripDetail(getTrip(db, trip.id)));
  } catch (err) {
    console.error('Get trip error:', err);
    error(res, '获取出游计划失败');
  }
});

router.put('/:id', authMiddleware, requireMenu('travel_trips'), (req, res) => {
  try {
    const trip = loadAccessibleTrip(req, res);
    if (!trip) return;
    if (forbidIfCannotWrite(req, res, trip)) return;
    const payload = parseTripPayload({ ...trip, ...req.body }, { partial: true });
    const db = getDb();
    db.run(
      `UPDATE trips SET
        title = ?, destination = ?, start_date = ?, end_date = ?, status = ?, summary = ?,
        party_size = ?, visibility = ?, cover_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        payload.title ?? trip.title,
        payload.destination ?? trip.destination,
        payload.start_date ?? trip.start_date,
        payload.end_date ?? trip.end_date,
        payload.status ?? trip.status,
        payload.summary ?? trip.summary,
        payload.party_size ?? trip.party_size,
        'private',
        payload.cover_url ?? trip.cover_url,
        trip.id,
      ]
    );
    saveDb();
    success(res, presentTripDetail(getTrip(db, trip.id)), '保存成功');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    console.error('Update trip error:', err);
    error(res, '更新出游计划失败');
  }
});

router.delete('/:id', authMiddleware, requireMenu('travel_trips'), (req, res) => {
  try {
    const trip = loadAccessibleTrip(req, res);
    if (!trip) return;
    if (forbidIfCannotWrite(req, res, trip)) return;
    const db = getDb();
    db.run('UPDATE budgets SET trip_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE trip_id = ?', [trip.id]);
    db.run('DELETE FROM trip_days WHERE trip_id = ?', [trip.id]);
    db.run('DELETE FROM trips WHERE id = ?', [trip.id]);
    saveDb();
    success(res, null, '删除成功');
  } catch (err) {
    console.error('Delete trip error:', err);
    error(res, '删除出游计划失败');
  }
});

router.put('/:id/days', authMiddleware, requireMenu('travel_trips'), (req, res) => {
  try {
    const trip = loadAccessibleTrip(req, res);
    if (!trip) return;
    if (forbidIfCannotWrite(req, res, trip)) return;
    const incoming = Array.isArray(req.body?.days) ? req.body.days : [];
    const db = getDb();
    const existing = getDays(db, trip.id);
    const keepIds = new Set();

    incoming.forEach((day, index) => {
      const dayIndex = Number(day.day_index) || index + 1;
      const date = isIsoDate(day.date) ? day.date : null;
      const title = day.title == null ? '' : String(day.title);
      const lodging = day.lodging == null ? '' : String(day.lodging);
      const notes = day.notes == null ? '' : String(day.notes);
      const sortOrder = Number.isFinite(Number(day.sort_order)) ? Number(day.sort_order) : index;
      if (day.id && existing.some((row) => row.id === Number(day.id))) {
        db.run(
          `UPDATE trip_days SET day_index = ?, date = ?, title = ?, lodging = ?, notes = ?, sort_order = ?
           WHERE id = ? AND trip_id = ?`,
          [dayIndex, date, title, lodging, notes, sortOrder, Number(day.id), trip.id]
        );
        keepIds.add(Number(day.id));
      } else {
        db.run(
          `INSERT INTO trip_days (trip_id, day_index, date, title, lodging, notes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [trip.id, dayIndex, date, title, lodging, notes, sortOrder]
        );
        keepIds.add(lastInsertId(db));
      }
    });

    for (const row of existing) {
      if (!keepIds.has(row.id)) {
        db.run('DELETE FROM trip_days WHERE id = ? AND trip_id = ?', [row.id, trip.id]);
      }
    }

    saveDb();
    success(res, presentTripDetail(getTrip(db, trip.id)), '日程已保存');
  } catch (err) {
    console.error('Save trip days error:', err);
    error(res, '保存日程失败');
  }
});

module.exports = router;

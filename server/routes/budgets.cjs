const express = require('express');
const { getDb, saveDb } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const {
  requireMenu,
  buildBudgetListFilter,
  canReadBudget,
  canWriteBudget,
  canReadTrip,
} = require('../middleware/permission.cjs');
const { isIsoDate } = require('../lib/tripDays.cjs');
const { syncTripStatuses } = require('../lib/tripStatus.cjs');
const {
  parseIncludeOptional,
  summarizeTrip,
  presentBudgetItem,
  presentExpense,
  toMajor,
  resolveItemMoney,
  resolveItemUnitMoney,
  persistBudgetItemMoney,
  persistExpenseMoney,
} = require('../lib/tripMoney.cjs');

const router = express.Router();

const BUDGET_STATUSES = new Set(['booked', 'pending', 'estimated']);
const CURRENCIES = new Set(['CNY', 'JPY', 'USD', 'EUR', 'KRW', 'HKD', 'THB']);
const TRIP_STATUSES = new Set(['planning', 'upcoming', 'ongoing', 'completed', 'cancelled']);

function success(res, data, message = 'success', code = 200) {
  return res.status(code).json({ code, message, data });
}

function error(res, message = '操作失败', code = 500) {
  return res.status(code).json({ code, message, data: null });
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

function normalizeCurrency(value, fallback = 'CNY') {
  const code = String(value || fallback).toUpperCase();
  return CURRENCIES.has(code) ? code : fallback;
}

function normalizeBudgetStatus(value, fallback = 'pending') {
  const status = String(value || fallback);
  return BUDGET_STATUSES.has(status) ? status : fallback;
}

function markLinkedBudgetItemBooked(db, budget, budgetItemId) {
  if (!budgetItemId) return;
  const item = queryOne(
    db,
    'SELECT * FROM budget_items WHERE id = ? AND budget_id = ?',
    [budgetItemId, budget.id]
  );
  if (!item) return;
  const money = resolveItemMoney(item, budget);
  const unit = resolveItemUnitMoney(item, budget);
  db.run(
    `UPDATE budget_items
     SET status = 'booked', amount = ?, amount_base = ?, unit_amount = ?, unit_amount_base = ?
     WHERE id = ? AND budget_id = ?`,
    [money.tripMinor, money.baseMinor, unit.tripMinor, unit.baseMinor, budgetItemId, budget.id]
  );
}

function normalizeFxRate(tripCurrency, baseCurrency, fxRate) {
  if (tripCurrency === baseCurrency) return 1;
  const rate = Number(fxRate);
  if (!Number.isFinite(rate) || rate <= 0) return 1;
  return rate;
}

function normalizePartySize(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function getBudget(db, id) {
  return queryOne(db, 'SELECT * FROM budgets WHERE id = ?', [id]);
}

function getBudgetItems(db, budgetId) {
  return queryAll(
    db,
    'SELECT * FROM budget_items WHERE budget_id = ? ORDER BY sort_order ASC, id ASC',
    [budgetId]
  );
}

function getExpenses(db, budgetId) {
  return queryAll(
    db,
    'SELECT * FROM budget_expenses WHERE budget_id = ? ORDER BY spent_on DESC, id DESC',
    [budgetId]
  );
}

function getTrip(db, tripId) {
  if (!tripId) return null;
  return queryOne(
    db,
    'SELECT id, title, destination, start_date, end_date, status, party_size FROM trips WHERE id = ?',
    [tripId]
  );
}

function presentBudget(budget, extras = {}) {
  return {
    ...budget,
    party_size: Number(budget.party_size) || 1,
    fx_rate: Number(budget.fx_rate) || 1,
    is_main: Number(budget.is_main) === 1,
    ...extras,
  };
}

function presentBudgetDetail(budget, { includeOptional = false } = {}) {
  const db = getDb();
  const items = getBudgetItems(db, budget.id);
  const expenses = getExpenses(db, budget.id);
  return presentBudget(budget, {
    trip: getTrip(db, budget.trip_id),
    items: items.map((item) => presentBudgetItem(item, budget)),
    expenses: expenses.map((item) => presentExpense(item, budget)),
    summary_stats: summarizeTrip(budget, items, expenses, { includeOptional }),
  });
}

function loadRelated(db, ids) {
  if (!ids.length) return { items: [], expenses: [] };
  const placeholders = ids.map(() => '?').join(',');
  const items = queryAll(db, `SELECT * FROM budget_items WHERE budget_id IN (${placeholders})`, ids);
  const expenses = queryAll(db, `SELECT * FROM budget_expenses WHERE budget_id IN (${placeholders})`, ids);
  return { items, expenses };
}

function groupByBudgetId(rows) {
  const map = {};
  for (const row of rows) {
    if (!map[row.budget_id]) map[row.budget_id] = [];
    map[row.budget_id].push(row);
  }
  return map;
}

function attachSummaries(budgets, items, expenses, includeOptional) {
  const db = getDb();
  const itemMap = groupByBudgetId(items);
  const expenseMap = groupByBudgetId(expenses);
  return budgets.map((budget) => presentBudget(budget, {
    trip: getTrip(db, budget.trip_id),
    summary_stats: summarizeTrip(
      budget,
      itemMap[budget.id] || [],
      expenseMap[budget.id] || [],
      { includeOptional }
    ),
  }));
}

function assertTripLink(db, user, tripId, exceptBudgetId) {
  if (!tripId) return null;
  const trip = queryOne(db, 'SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) {
    const err = new Error('出游计划不存在');
    err.statusCode = 404;
    throw err;
  }
  if (!canReadTrip(user, trip)) {
    const err = new Error('无权关联该出游计划');
    err.statusCode = 403;
    throw err;
  }
  const taken = queryOne(
    db,
    'SELECT id FROM budgets WHERE trip_id = ? AND id != ?',
    [tripId, exceptBudgetId || 0]
  );
  if (taken) {
    const err = new Error('该出游计划已关联其他预算');
    err.statusCode = 400;
    throw err;
  }
  return trip;
}

function setMainLine(db, budgetId, isMain) {
  if (isMain) {
    db.run('UPDATE budgets SET is_main = 0 WHERE IFNULL(is_main, 0) = 1');
    db.run('UPDATE budgets SET is_main = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [budgetId]);
    return;
  }
  db.run('UPDATE budgets SET is_main = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [budgetId]);
}

function emptyTotals() {
  return {
    planned_cny: 0,
    booked_cny: 0,
    pending_cny: 0,
    spent_cny: 0,
    remaining_cny: 0,
  };
}

function totalsFromStats(stats) {
  if (!stats) return emptyTotals();
  return {
    planned_cny: stats.planned_total_cny || 0,
    booked_cny: stats.booked_total_cny || 0,
    pending_cny: stats.pending_total_cny || 0,
    spent_cny: stats.spent_total_cny || 0,
    remaining_cny: stats.remaining_cny || 0,
  };
}

function parseBudgetPayload(body = {}, { partial = false, current = {} } = {}) {
  const payload = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) {
      const err = new Error('请填写预算标题');
      err.statusCode = 400;
      throw err;
    }
    payload.title = title;
  }
  if (!partial || body.trip_id !== undefined) {
    payload.trip_id = body.trip_id ? Number(body.trip_id) : null;
    if (payload.trip_id && !Number.isFinite(payload.trip_id)) payload.trip_id = null;
  }
  if (!partial || body.party_size !== undefined) payload.party_size = normalizePartySize(body.party_size);
  if (!partial || body.base_currency !== undefined) payload.base_currency = normalizeCurrency(body.base_currency, current.base_currency || 'CNY');
  if (!partial || body.trip_currency !== undefined) {
    payload.trip_currency = normalizeCurrency(body.trip_currency, payload.base_currency || current.base_currency || 'CNY');
  }
  if (!partial || body.fx_rate !== undefined || body.trip_currency !== undefined || body.base_currency !== undefined) {
    payload.fx_rate = normalizeFxRate(
      payload.trip_currency || current.trip_currency || 'CNY',
      payload.base_currency || current.base_currency || 'CNY',
      body.fx_rate !== undefined ? body.fx_rate : current.fx_rate
    );
  }
  if (!partial || body.fx_date !== undefined) {
    payload.fx_date = body.fx_date && isIsoDate(body.fx_date) ? body.fx_date : null;
  }
  if (!partial || body.note !== undefined) payload.note = body.note == null ? '' : String(body.note);
  return payload;
}

function forbidIfCannotWrite(req, res, budget) {
  if (!canWriteBudget(req.user, budget)) {
    error(res, '权限不足', 403);
    return true;
  }
  return false;
}

function loadAccessibleBudget(req, res) {
  const db = getDb();
  const budget = getBudget(db, req.params.id);
  if (!budget) {
    error(res, '预算不存在', 404);
    return null;
  }
  if (!canReadBudget(req.user, budget)) {
    error(res, '权限不足', 403);
    return null;
  }
  return budget;
}

function refreshTripStatuses(db) {
  if (syncTripStatuses(db)) saveDb();
}

router.get('/', authMiddleware, requireMenu('travel_budget'), (req, res) => {
  try {
    const db = getDb();
    refreshTripStatuses(db);
    const includeOptional = parseIncludeOptional(req.query.include_optional);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const listFilter = buildBudgetListFilter(req.user);
    const where = [listFilter.sql.startsWith('created_by') ? `b.${listFilter.sql}` : listFilter.sql];
    const params = [...listFilter.params];

    if (req.query.title) {
      where.push('b.title LIKE ?');
      params.push(`%${req.query.title}%`);
    }
    if (req.query.status && TRIP_STATUSES.has(String(req.query.status))) {
      where.push('t.status = ?');
      params.push(req.query.status);
    }
    if (req.query.dateFrom) {
      where.push('t.start_date >= ?');
      params.push(req.query.dateFrom);
    }
    if (req.query.dateTo) {
      where.push('t.end_date <= ?');
      params.push(req.query.dateTo);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;
    const fromClause = 'FROM budgets b LEFT JOIN trips t ON t.id = b.trip_id';
    const total = queryOne(db, `SELECT COUNT(*) as total ${fromClause} ${whereClause}`, params).total;
    const offset = (page - 1) * pageSize;
    const rows = queryAll(
      db,
      `SELECT b.* ${fromClause} ${whereClause} ORDER BY b.is_main DESC, b.updated_at DESC, b.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const pageRelated = loadRelated(db, rows.map((row) => row.id));
    const presented = attachSummaries(rows, pageRelated.items, pageRelated.expenses, includeOptional);

    const accessSql = listFilter.sql.startsWith('created_by') ? `b.${listFilter.sql}` : listFilter.sql;
    const mainBudget = queryOne(
      db,
      `SELECT b.* FROM budgets b WHERE ${accessSql} AND IFNULL(b.is_main, 0) = 1`,
      listFilter.params
    );
    let totals = emptyTotals();
    if (mainBudget) {
      const related = loadRelated(db, [mainBudget.id]);
      const [mainPresented] = attachSummaries([mainBudget], related.items, related.expenses, includeOptional);
      totals = totalsFromStats(mainPresented?.summary_stats);
    }

    return res.status(200).json({
      code: 200,
      message: 'success',
      data: presented,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      totals,
      main_budget_id: mainBudget ? mainBudget.id : null,
    });
  } catch (err) {
    console.error('List budgets error:', err);
    error(res, '获取预算失败');
  }
});

router.post('/', authMiddleware, requireMenu('travel_budget'), (req, res) => {
  try {
    if (!canWriteBudget(req.user, { created_by: req.user.username })) {
      return error(res, '权限不足', 403);
    }
    const payload = parseBudgetPayload(req.body);
    const db = getDb();
    const trip = assertTripLink(db, req.user, payload.trip_id, null);
    if (trip && payload.party_size == null) payload.party_size = normalizePartySize(trip.party_size);
    db.run(
      `INSERT INTO budgets (
        title, trip_id, party_size, base_currency, trip_currency, fx_rate, fx_date, note, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.title,
        payload.trip_id || null,
        payload.party_size || 1,
        payload.base_currency,
        payload.trip_currency,
        payload.fx_rate,
        payload.fx_date,
        payload.note || '',
        req.user.username,
      ]
    );
    saveDb();
    success(res, presentBudgetDetail(getBudget(db, lastInsertId(db))), '创建成功', 201);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    console.error('Create budget error:', err);
    error(res, '创建预算失败');
  }
});

router.get('/:id', authMiddleware, requireMenu('travel_budget'), (req, res) => {
  try {
    const budget = loadAccessibleBudget(req, res);
    if (!budget) return;
    refreshTripStatuses(getDb());
    const includeOptional = parseIncludeOptional(req.query.include_optional);
    success(res, presentBudgetDetail(budget, { includeOptional }));
  } catch (err) {
    console.error('Get budget error:', err);
    error(res, '获取预算失败');
  }
});

router.put('/:id', authMiddleware, requireMenu('travel_budget'), (req, res) => {
  try {
    const budget = loadAccessibleBudget(req, res);
    if (!budget) return;
    if (forbidIfCannotWrite(req, res, budget)) return;
    const payload = parseBudgetPayload(req.body, { partial: true, current: budget });
    const db = getDb();
    const tripId = payload.trip_id !== undefined ? payload.trip_id : budget.trip_id;
    assertTripLink(db, req.user, tripId, budget.id);
    db.run(
      `UPDATE budgets SET
        title = ?, trip_id = ?, party_size = ?, base_currency = ?, trip_currency = ?,
        fx_rate = ?, fx_date = ?, note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        payload.title ?? budget.title,
        tripId || null,
        payload.party_size ?? budget.party_size,
        payload.base_currency ?? budget.base_currency,
        payload.trip_currency ?? budget.trip_currency,
        payload.fx_rate ?? budget.fx_rate,
        payload.fx_date !== undefined ? payload.fx_date : budget.fx_date,
        payload.note ?? budget.note,
        budget.id,
      ]
    );
    saveDb();
    success(res, presentBudgetDetail(getBudget(db, budget.id), {
      includeOptional: parseIncludeOptional(req.query.include_optional),
    }), '保存成功');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    console.error('Update budget error:', err);
    error(res, '更新预算失败');
  }
});

router.put('/:id/main', authMiddleware, requireMenu('travel_budget'), (req, res) => {
  try {
    const budget = loadAccessibleBudget(req, res);
    if (!budget) return;
    if (forbidIfCannotWrite(req, res, budget)) return;
    const isMain = req.body?.is_main === true || req.body?.is_main === 1 || req.body?.is_main === '1';
    const db = getDb();
    setMainLine(db, budget.id, isMain);
    saveDb();
    success(res, presentBudget(getBudget(db, budget.id)), isMain ? '已设为主线' : '已取消主线');
  } catch (err) {
    console.error('Set main budget error:', err);
    error(res, '设置主线失败');
  }
});

router.delete('/:id', authMiddleware, requireMenu('travel_budget'), (req, res) => {
  try {
    const budget = loadAccessibleBudget(req, res);
    if (!budget) return;
    if (forbidIfCannotWrite(req, res, budget)) return;
    const db = getDb();
    const wasMain = Number(budget.is_main) === 1;
    db.run('DELETE FROM budget_expenses WHERE budget_id = ?', [budget.id]);
    db.run('DELETE FROM budget_items WHERE budget_id = ?', [budget.id]);
    db.run('DELETE FROM budgets WHERE id = ?', [budget.id]);
    if (wasMain) {
      const nextMain = queryOne(db, 'SELECT id FROM budgets ORDER BY id ASC');
      if (nextMain) setMainLine(db, nextMain.id, true);
    }
    saveDb();
    success(res, null, '删除成功');
  } catch (err) {
    console.error('Delete budget error:', err);
    error(res, '删除预算失败');
  }
});

router.put('/:id/items', authMiddleware, requireMenu('travel_budget'), (req, res) => {
  try {
    const budget = loadAccessibleBudget(req, res);
    if (!budget) return;
    if (forbidIfCannotWrite(req, res, budget)) return;
    const incoming = Array.isArray(req.body?.items) ? req.body.items : [];
    const db = getDb();
    const existing = getBudgetItems(db, budget.id);
    const keepIds = new Set();

    incoming.forEach((item, index) => {
      const title = String(item.title || '').trim();
      if (!title) return;
      const status = normalizeBudgetStatus(item.status);
      const persisted = persistBudgetItemMoney({ ...item, status }, budget);
      const category = String(item.category || 'misc');
      const optional = item.optional === true || item.optional === 1 || item.optional === '1' ? 1 : 0;
      const note = item.note == null ? '' : String(item.note);
      const sortOrder = Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : index;
      const quoteIn = persisted.quoteIn;

      if (item.id && existing.some((row) => row.id === Number(item.id))) {
        db.run(
          `UPDATE budget_items
           SET category = ?, title = ?, qty = ?, unit_amount = ?, unit_amount_base = ?, amount = ?, amount_base = ?,
               quote_in = ?, status = ?, optional = ?, note = ?, sort_order = ?
           WHERE id = ? AND budget_id = ?`,
          [
            category, title, persisted.safeQty, persisted.unitTrip, persisted.unitBase,
            persisted.amountTrip, persisted.amountBase, quoteIn, status, optional, note, sortOrder,
            Number(item.id), budget.id,
          ]
        );
        keepIds.add(Number(item.id));
      } else {
        db.run(
          `INSERT INTO budget_items
            (budget_id, category, title, qty, unit_amount, unit_amount_base, amount, amount_base, quote_in, status, optional, note, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            budget.id, category, title, persisted.safeQty, persisted.unitTrip, persisted.unitBase,
            persisted.amountTrip, persisted.amountBase, quoteIn, status, optional, note, sortOrder,
          ]
        );
        keepIds.add(lastInsertId(db));
      }
    });

    for (const row of existing) {
      if (!keepIds.has(row.id)) {
        db.run('UPDATE budget_expenses SET budget_item_id = NULL WHERE budget_item_id = ?', [row.id]);
        db.run('DELETE FROM budget_items WHERE id = ? AND budget_id = ?', [row.id, budget.id]);
      }
    }

    saveDb();
    success(res, presentBudgetDetail(getBudget(db, budget.id), {
      includeOptional: parseIncludeOptional(req.body?.include_optional),
    }), '预算明细已保存');
  } catch (err) {
    console.error('Save budget items error:', err);
    error(res, '保存预算明细失败');
  }
});

router.post('/:id/expenses', authMiddleware, requireMenu('travel_budget'), (req, res) => {
  try {
    const budget = loadAccessibleBudget(req, res);
    if (!budget) return;
    if (forbidIfCannotWrite(req, res, budget)) return;
    const title = String(req.body?.title || '').trim();
    if (!title) return error(res, '请填写消费项目', 400);
    const { amountMinor, amountBaseMinor } = persistExpenseMoney(req.body, budget);
    const category = req.body?.category ? String(req.body.category) : '';
    const spentOn = isIsoDate(req.body?.spent_on) ? req.body.spent_on : null;
    const note = req.body?.note == null ? '' : String(req.body.note);
    let budgetItemId = req.body?.budget_item_id ? Number(req.body.budget_item_id) : null;
    const db = getDb();
    if (budgetItemId) {
      const item = queryOne(
        db,
        'SELECT id FROM budget_items WHERE id = ? AND budget_id = ?',
        [budgetItemId, budget.id]
      );
      if (!item) budgetItemId = null;
    }
    db.run(
      `INSERT INTO budget_expenses
        (budget_id, budget_item_id, category, title, amount, amount_base, spent_on, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [budget.id, budgetItemId, category, title, amountMinor, amountBaseMinor, spentOn, note, req.user.username]
    );
    markLinkedBudgetItemBooked(db, budget, budgetItemId);
    saveDb();
    success(res, presentBudgetDetail(getBudget(db, budget.id)), '记账成功', 201);
  } catch (err) {
    console.error('Create expense error:', err);
    error(res, '新增消费失败');
  }
});

router.put('/:id/expenses/:eid', authMiddleware, requireMenu('travel_budget'), (req, res) => {
  try {
    const budget = loadAccessibleBudget(req, res);
    if (!budget) return;
    if (forbidIfCannotWrite(req, res, budget)) return;
    const db = getDb();
    const expense = queryOne(
      db,
      'SELECT * FROM budget_expenses WHERE id = ? AND budget_id = ?',
      [req.params.eid, budget.id]
    );
    if (!expense) return error(res, '消费记录不存在', 404);

    const title = req.body?.title != null ? String(req.body.title).trim() : expense.title;
    if (!title) return error(res, '请填写消费项目', 400);
    let amountMinor = expense.amount;
    let amountBaseMinor = expense.amount_base;
    if (req.body?.amount != null || req.body?.amount_cny != null) {
      const persisted = persistExpenseMoney({
        amount: req.body.amount != null ? req.body.amount : toMajor(expense.amount, budget.trip_currency),
        amount_cny: req.body.amount_cny != null
          ? req.body.amount_cny
          : (req.body.amount == null && expense.amount_base != null
            ? toMajor(expense.amount_base, budget.base_currency)
            : undefined),
      }, budget);
      amountMinor = persisted.amountMinor;
      amountBaseMinor = persisted.amountBaseMinor;
    }
    const category = req.body?.category != null ? String(req.body.category) : expense.category;
    const spentOn = req.body?.spent_on !== undefined
      ? (isIsoDate(req.body.spent_on) ? req.body.spent_on : null)
      : expense.spent_on;
    const note = req.body?.note != null ? String(req.body.note) : expense.note;
    let budgetItemId = req.body?.budget_item_id !== undefined
      ? (req.body.budget_item_id ? Number(req.body.budget_item_id) : null)
      : expense.budget_item_id;
    if (budgetItemId) {
      const item = queryOne(
        db,
        'SELECT id FROM budget_items WHERE id = ? AND budget_id = ?',
        [budgetItemId, budget.id]
      );
      if (!item) budgetItemId = null;
    }

    db.run(
      `UPDATE budget_expenses
       SET budget_item_id = ?, category = ?, title = ?, amount = ?, amount_base = ?, spent_on = ?, note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND budget_id = ?`,
      [budgetItemId, category, title, amountMinor, amountBaseMinor, spentOn, note, expense.id, budget.id]
    );
    markLinkedBudgetItemBooked(db, budget, budgetItemId);
    saveDb();
    success(res, presentBudgetDetail(getBudget(db, budget.id)), '记账已更新');
  } catch (err) {
    console.error('Update expense error:', err);
    error(res, '更新消费失败');
  }
});

router.delete('/:id/expenses/:eid', authMiddleware, requireMenu('travel_budget'), (req, res) => {
  try {
    const budget = loadAccessibleBudget(req, res);
    if (!budget) return;
    if (forbidIfCannotWrite(req, res, budget)) return;
    const db = getDb();
    const expense = queryOne(
      db,
      'SELECT id FROM budget_expenses WHERE id = ? AND budget_id = ?',
      [req.params.eid, budget.id]
    );
    if (!expense) return error(res, '消费记录不存在', 404);
    db.run('DELETE FROM budget_expenses WHERE id = ? AND budget_id = ?', [expense.id, budget.id]);
    saveDb();
    success(res, presentBudgetDetail(getBudget(db, budget.id)), '已删除');
  } catch (err) {
    console.error('Delete expense error:', err);
    error(res, '删除消费失败');
  }
});

module.exports = router;

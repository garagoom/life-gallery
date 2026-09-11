const express = require('express');
const { getDb, saveDb } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const {
  requireMenu,
  requireAnyMenu,
  hasDataPerm,
  canReadTrip,
  canWriteTrip,
  canWriteBudget,
} = require('../middleware/permission.cjs');
const { isIsoDate } = require('../lib/tripDays.cjs');
const {
  persistShoppingItemMoney,
  presentShoppingItem,
  summarizeShopping,
  nextBudgetSync,
  applyBudgetDelta,
  isBought,
  isShoppingCategory,
} = require('../lib/shopping.cjs');
const { resolveItemMoney } = require('../lib/tripMoney.cjs');

const router = express.Router();
const TRAVEL_MENUS = ['travel_shopping', 'travel_trips', 'travel_budget'];

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

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeFxRate(tripCurrency, baseCurrency, fxRate) {
  if (tripCurrency === baseCurrency) return 1;
  const rate = Number(fxRate);
  if (!Number.isFinite(rate) || rate <= 0) return 1;
  return rate;
}

function getList(db, id) {
  return queryOne(db, 'SELECT * FROM shopping_lists WHERE id = ?', [id]);
}

function getItems(db, listId) {
  return queryAll(
    db,
    'SELECT * FROM shopping_items WHERE list_id = ? ORDER BY sort_order ASC, id ASC',
    [listId]
  );
}

function getTrip(db, tripId) {
  if (!tripId) return null;
  return queryOne(db, 'SELECT * FROM trips WHERE id = ?', [tripId]);
}

function getBudgetByTrip(db, tripId) {
  if (!tripId) return null;
  return queryOne(db, 'SELECT * FROM budgets WHERE trip_id = ?', [tripId]);
}

function getBudgetItems(db, budgetId) {
  if (!budgetId) return [];
  return queryAll(
    db,
    'SELECT id, title, category, amount, amount_base FROM budget_items WHERE budget_id = ? ORDER BY sort_order ASC, id ASC',
    [budgetId]
  );
}

function getShoppingBudgetItems(db, budgetId) {
  return getBudgetItems(db, budgetId).filter((item) => isShoppingCategory(item.category));
}

function presentList(list, extras = {}) {
  return {
    ...list,
    fx_rate: Number(list.fx_rate) || 1,
    ...extras,
  };
}

function presentListDetail(list) {
  const db = getDb();
  const items = getItems(db, list.id);
  const trip = getTrip(db, list.trip_id);
  const budget = getBudgetByTrip(db, list.trip_id);
  return presentList(list, {
    trip: trip ? {
      id: trip.id,
      title: trip.title,
      destination: trip.destination,
      start_date: trip.start_date,
      end_date: trip.end_date,
      status: trip.status,
    } : null,
    budget: budget ? {
      id: budget.id,
      title: budget.title,
      items: getShoppingBudgetItems(db, budget.id).map((item) => ({ id: item.id, title: item.title, category: item.category })),
    } : null,
    items: items.map((item) => presentShoppingItem(item, list)),
    stats: summarizeShopping(list, items),
  });
}

function canReadList(user, list, trip) {
  if (!user || !list) return false;
  if (hasDataPerm(user, 'travel_shopping.all')) return true;
  if (hasDataPerm(user, 'travel_shopping.own') && list.created_by === user.username) return true;
  return canReadTrip(user, trip);
}

function canWriteList(user, list, trip) {
  if (!user || !list) return false;
  if (hasDataPerm(user, 'travel_shopping.all')) return true;
  if (hasDataPerm(user, 'travel_shopping.own') && list.created_by === user.username) return true;
  return canWriteTrip(user, trip);
}

function buildListFilter(user) {
  if (hasDataPerm(user, 'travel_shopping.all') || hasDataPerm(user, 'trips.read.all') || hasDataPerm(user, 'trips.write.all')) {
    return { sql: '1=1', params: [] };
  }
  if (hasDataPerm(user, 'travel_shopping.own') || hasDataPerm(user, 'trips.read.own') || hasDataPerm(user, 'trips.write.own')) {
    return { sql: '(s.created_by = ? OR t.created_by = ?)', params: [user.username, user.username] };
  }
  return { sql: '1=0', params: [] };
}

function loadAccessibleList(req, res, { write = false } = {}) {
  const db = getDb();
  const list = getList(db, req.params.id);
  if (!list) {
    error(res, '购物清单不存在', 404);
    return null;
  }
  const trip = getTrip(db, list.trip_id);
  const allowed = write ? canWriteList(req.user, list, trip) : canReadList(req.user, list, trip);
  if (!allowed) {
    error(res, '权限不足', 403);
    return null;
  }
  return { list, trip };
}

function addToBudgetItem(db, user, budgetItemId, deltaTrip, deltaBase) {
  if (!budgetItemId || (!deltaTrip && !deltaBase)) return;
  const item = queryOne(db, 'SELECT * FROM budget_items WHERE id = ?', [budgetItemId]);
  if (!item) throw fail('关联的预算项不存在', 400);
  const budget = queryOne(db, 'SELECT * FROM budgets WHERE id = ?', [item.budget_id]);
  if (!budget) throw fail('关联的预算不存在', 400);
  if (!canWriteBudget(user, budget)) throw fail('无权写入该预算项', 403);
  const money = resolveItemMoney(item, budget);
  const next = applyBudgetDelta(
    { amount: money.tripMinor, amount_base: money.baseMinor },
    deltaTrip,
    deltaBase
  );
  db.run(
    `UPDATE budget_items
     SET amount = ?, amount_base = ?, unit_amount = ?, unit_amount_base = ?, status = 'booked'
     WHERE id = ?`,
    [next.amount, next.amountBase, next.amount, next.amountBase, budgetItemId]
  );
}

function reverseItem(db, user, row) {
  if (!isBought(row.bought) || !row.budget_item_id) return;
  addToBudgetItem(db, user, row.budget_item_id, -(Number(row.applied_amount) || 0), -(Number(row.applied_amount_base) || 0));
}

router.get('/', authMiddleware, requireAnyMenu(...TRAVEL_MENUS), (req, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const listFilter = buildListFilter(req.user);
    const where = [listFilter.sql];
    const params = [...listFilter.params];
    if (req.query.title) {
      where.push('s.title LIKE ?');
      params.push(`%${req.query.title}%`);
    }
    if (req.query.trip_id) {
      where.push('s.trip_id = ?');
      params.push(Number(req.query.trip_id));
    }
    const whereClause = `WHERE ${where.join(' AND ')}`;
    const total = queryOne(
      db,
      `SELECT COUNT(*) as total
       FROM shopping_lists s
       LEFT JOIN trips t ON t.id = s.trip_id
       ${whereClause}`,
      params
    ).total;
    const offset = (page - 1) * pageSize;
    const rows = queryAll(
      db,
      `SELECT s.*
       FROM shopping_lists s
       LEFT JOIN trips t ON t.id = s.trip_id
       ${whereClause}
       ORDER BY s.updated_at DESC, s.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const data = rows.map((list) => {
      const items = getItems(db, list.id);
      const trip = getTrip(db, list.trip_id);
      return presentList(list, {
        trip: trip ? {
          id: trip.id,
          title: trip.title,
          destination: trip.destination,
          start_date: trip.start_date,
          end_date: trip.end_date,
          status: trip.status,
        } : null,
        stats: summarizeShopping(list, items),
      });
    });
    return res.status(200).json({
      code: 200,
      message: 'success',
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error('List shopping error:', err);
    error(res, '获取购物清单失败');
  }
});

router.post('/', authMiddleware, requireMenu('travel_shopping'), (req, res) => {
  try {
    const tripId = Number(req.body?.trip_id);
    if (!tripId) return error(res, '请选择出游计划', 400);
    const db = getDb();
    const trip = getTrip(db, tripId);
    if (!trip) return error(res, '出游计划不存在', 404);
    if (!canReadTrip(req.user, trip)) return error(res, '无权关联该出游计划', 403);
    const existing = queryOne(db, 'SELECT * FROM shopping_lists WHERE trip_id = ?', [tripId]);
    if (existing) {
      if (!canReadList(req.user, existing, trip)) return error(res, '权限不足', 403);
      return success(res, presentListDetail(existing), '已有购物清单');
    }
    const budget = getBudgetByTrip(db, tripId);
    const tripCurrency = budget?.trip_currency || 'CNY';
    const baseCurrency = budget?.base_currency || 'CNY';
    const fxRate = normalizeFxRate(tripCurrency, baseCurrency, budget?.fx_rate);
    const title = String(req.body?.title || '').trim() || `${trip.title} 购物清单`;
    db.run(
      `INSERT INTO shopping_lists (
        trip_id, title, trip_currency, base_currency, fx_rate, fx_date, note, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tripId,
        title,
        tripCurrency,
        baseCurrency,
        fxRate,
        budget?.fx_date || null,
        req.body?.note == null ? '' : String(req.body.note),
        req.user.username,
      ]
    );
    saveDb();
    success(res, presentListDetail(getList(db, lastInsertId(db))), '创建成功', 201);
  } catch (err) {
    console.error('Create shopping error:', err);
    error(res, '创建购物清单失败');
  }
});

router.get('/:id', authMiddleware, requireAnyMenu(...TRAVEL_MENUS), (req, res) => {
  try {
    const loaded = loadAccessibleList(req, res);
    if (!loaded) return;
    success(res, presentListDetail(loaded.list));
  } catch (err) {
    console.error('Get shopping error:', err);
    error(res, '获取购物清单失败');
  }
});

router.put('/:id', authMiddleware, requireMenu('travel_shopping'), (req, res) => {
  try {
    const loaded = loadAccessibleList(req, res, { write: true });
    if (!loaded) return;
    const { list } = loaded;
    const title = String(req.body?.title ?? list.title ?? '').trim();
    if (!title) return error(res, '请填写标题', 400);
    const tripCurrency = String(req.body?.trip_currency || list.trip_currency || 'CNY').toUpperCase();
    const baseCurrency = String(req.body?.base_currency || list.base_currency || 'CNY').toUpperCase();
    const fxRate = normalizeFxRate(tripCurrency, baseCurrency, req.body?.fx_rate ?? list.fx_rate);
    const fxDate = req.body?.fx_date && isIsoDate(req.body.fx_date) ? req.body.fx_date : (list.fx_date || null);
    const note = req.body?.note == null ? (list.note || '') : String(req.body.note);
    const db = getDb();
    db.run(
      `UPDATE shopping_lists
       SET title = ?, trip_currency = ?, base_currency = ?, fx_rate = ?, fx_date = ?, note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, tripCurrency, baseCurrency, fxRate, fxDate, note, list.id]
    );
    saveDb();
    success(res, presentListDetail(getList(db, list.id)), '保存成功');
  } catch (err) {
    console.error('Update shopping error:', err);
    error(res, '保存购物清单失败');
  }
});

router.delete('/:id', authMiddleware, requireMenu('travel_shopping'), (req, res) => {
  try {
    const loaded = loadAccessibleList(req, res, { write: true });
    if (!loaded) return;
    const db = getDb();
    const items = getItems(db, loaded.list.id);
    for (const item of items) reverseItem(db, req.user, item);
    db.run('DELETE FROM shopping_items WHERE list_id = ?', [loaded.list.id]);
    db.run('DELETE FROM shopping_lists WHERE id = ?', [loaded.list.id]);
    saveDb();
    success(res, null, '删除成功');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    console.error('Delete shopping error:', err);
    error(res, '删除购物清单失败');
  }
});

router.put('/:id/items', authMiddleware, requireMenu('travel_shopping'), (req, res) => {
  try {
    const loaded = loadAccessibleList(req, res, { write: true });
    if (!loaded) return;
    const incoming = Array.isArray(req.body?.items) ? req.body.items : [];
    const db = getDb();
    let list = getList(db, loaded.list.id);
    if (req.body?.fx_rate != null || req.body?.trip_currency || req.body?.base_currency) {
      const tripCurrency = String(req.body?.trip_currency || list.trip_currency || 'CNY').toUpperCase();
      const baseCurrency = String(req.body?.base_currency || list.base_currency || 'CNY').toUpperCase();
      const fxRate = normalizeFxRate(tripCurrency, baseCurrency, req.body?.fx_rate ?? list.fx_rate);
      const fxDate = req.body?.fx_date && isIsoDate(req.body.fx_date) ? req.body.fx_date : (list.fx_date || null);
      db.run(
        `UPDATE shopping_lists
         SET trip_currency = ?, base_currency = ?, fx_rate = ?, fx_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [tripCurrency, baseCurrency, fxRate, fxDate, list.id]
      );
      list = getList(db, list.id);
    }
    const existing = getItems(db, list.id);
    const existingMap = new Map(existing.map((row) => [row.id, row]));
    const keepIds = new Set();
    const budget = getBudgetByTrip(db, list.trip_id);
    const budgetItemIds = new Set(getShoppingBudgetItems(db, budget?.id).map((item) => item.id));

    incoming.forEach((item, index) => {
      const title = String(item.title || '').trim();
      if (!title) return;
      const bought = isBought(item.bought);
      const current = item.id ? existingMap.get(Number(item.id)) : null;
      const requestedId = item.budget_item_id ? Number(item.budget_item_id) : null;
      const budgetItemId = requestedId && budgetItemIds.has(requestedId) ? requestedId : null;
      if (bought && !budgetItemId) throw fail('已买商品需要关联购物类别的预算项', 400);
      const persisted = persistShoppingItemMoney({ ...item, bought }, list);
      const place = item.place == null ? '' : String(item.place);
      const note = item.note == null ? '' : String(item.note);
      const sortOrder = Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : index;
      const sync = nextBudgetSync(current, {
        bought,
        budgetItemId,
        amountTrip: persisted.amountTrip,
        amountBase: persisted.amountBase,
      });
      for (const op of sync.ops) addToBudgetItem(db, req.user, op.budgetItemId, op.deltaTrip, op.deltaBase);

      if (current) {
        db.run(
          `UPDATE shopping_items
           SET title = ?, place = ?, quote_in = ?, amount = ?, amount_base = ?, budget_item_id = ?,
               bought = ?, applied_amount = ?, applied_amount_base = ?, note = ?, sort_order = ?
           WHERE id = ? AND list_id = ?`,
          [
            title, place, persisted.quoteIn, persisted.amountTrip, persisted.amountBase, budgetItemId,
            bought ? 1 : 0, sync.appliedAmount, sync.appliedAmountBase, note, sortOrder,
            current.id, list.id,
          ]
        );
        keepIds.add(current.id);
      } else {
        db.run(
          `INSERT INTO shopping_items (
            list_id, title, place, quote_in, amount, amount_base, budget_item_id,
            bought, applied_amount, applied_amount_base, note, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            list.id, title, place, persisted.quoteIn, persisted.amountTrip, persisted.amountBase, budgetItemId,
            bought ? 1 : 0, sync.appliedAmount, sync.appliedAmountBase, note, sortOrder,
          ]
        );
        keepIds.add(lastInsertId(db));
      }
    });

    for (const row of existing) {
      if (keepIds.has(row.id)) continue;
      reverseItem(db, req.user, row);
      db.run('DELETE FROM shopping_items WHERE id = ? AND list_id = ?', [row.id, list.id]);
    }

    db.run('UPDATE shopping_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [list.id]);
    saveDb();
    success(res, presentListDetail(getList(db, list.id)), '清单已保存');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    console.error('Save shopping items error:', err);
    error(res, '保存购物清单失败');
  }
});

module.exports = router;

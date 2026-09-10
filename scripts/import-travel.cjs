const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function one(db, sql, params = []) {
  return all(db, sql, params)[0] || null;
}

function lastId(db) {
  return one(db, 'SELECT last_insert_rowid() AS id')?.id;
}

function mapUser(name, prodNames, fallback) {
  const raw = String(name || '').trim();
  if (raw && prodNames.has(raw)) return raw;
  return fallback;
}

function deleteTripTree(db, tripId) {
  const budgets = all(db, 'SELECT id FROM budgets WHERE trip_id = ?', [tripId]);
  for (const budget of budgets) {
    db.run('DELETE FROM budget_expenses WHERE budget_id = ?', [budget.id]);
    db.run('DELETE FROM budget_items WHERE budget_id = ?', [budget.id]);
    db.run('DELETE FROM budgets WHERE id = ?', [budget.id]);
  }
  db.run('DELETE FROM trip_days WHERE trip_id = ?', [tripId]);
  db.run('DELETE FROM trips WHERE id = ?', [tripId]);
}

(async () => {
  const dataPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tmp-travel-export.json'));
  const dbPath = path.resolve(process.argv[3] || process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite'));
  const payload = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));

  const prodNames = new Set(all(db, 'SELECT username FROM users').map((row) => row.username));
  const fallbackUser = one(db, "SELECT username FROM users WHERE username = 'admin' OR role = 'admin' ORDER BY id ASC LIMIT 1")?.username || 'admin';

  const tripIdMap = new Map();
  const budgetIdMap = new Map();
  const itemIdMap = new Map();
  let imported = 0;
  let replaced = 0;

  for (const trip of payload.trips || []) {
    const createdBy = mapUser(trip.created_by, prodNames, fallbackUser);
    const existing = one(db, 'SELECT id FROM trips WHERE title = ? AND IFNULL(created_by, "") = ?', [trip.title, createdBy]);
    if (existing) {
      deleteTripTree(db, existing.id);
      replaced += 1;
    }
    db.run(
      `INSERT INTO trips (
        title, destination, start_date, end_date, status, summary, party_size,
        base_currency, trip_currency, fx_rate, fx_date, visibility, cover_url, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trip.title, trip.destination, trip.start_date, trip.end_date, trip.status, trip.summary, trip.party_size,
        trip.base_currency, trip.trip_currency, trip.fx_rate, trip.fx_date, trip.visibility, trip.cover_url,
        createdBy, trip.created_at, trip.updated_at,
      ]
    );
    const newTripId = lastId(db);
    tripIdMap.set(trip.id, newTripId);
    imported += 1;
  }

  for (const day of payload.trip_days || []) {
    const tripId = tripIdMap.get(day.trip_id);
    if (!tripId) continue;
    db.run(
      `INSERT INTO trip_days (trip_id, day_index, date, title, lodging, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tripId, day.day_index, day.date, day.title, day.lodging, day.notes, day.sort_order]
    );
  }

  for (const budget of payload.budgets || []) {
    const tripId = budget.trip_id ? tripIdMap.get(budget.trip_id) || null : null;
    const createdBy = mapUser(budget.created_by, prodNames, fallbackUser);
    const wantMain = Number(budget.is_main) === 1;
    if (wantMain) db.run('UPDATE budgets SET is_main = 0 WHERE IFNULL(is_main, 0) = 1');
    db.run(
      `INSERT INTO budgets (
        title, trip_id, party_size, base_currency, trip_currency, fx_rate, fx_date, note, is_main, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        budget.title, tripId, budget.party_size, budget.base_currency, budget.trip_currency, budget.fx_rate,
        budget.fx_date, budget.note, wantMain ? 1 : 0, createdBy, budget.created_at, budget.updated_at,
      ]
    );
    budgetIdMap.set(budget.id, lastId(db));
  }

  for (const item of payload.budget_items || []) {
    const budgetId = budgetIdMap.get(item.budget_id);
    if (!budgetId) continue;
    db.run(
      `INSERT INTO budget_items
        (budget_id, category, title, qty, unit_amount, unit_amount_base, amount, amount_base, quote_in, status, optional, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        budgetId, item.category, item.title, item.qty, item.unit_amount, item.unit_amount_base ?? null,
        item.amount, item.amount_base ?? null, item.quote_in || 'trip', item.status, item.optional, item.note, item.sort_order,
      ]
    );
    itemIdMap.set(item.id, lastId(db));
  }

  for (const expense of payload.budget_expenses || []) {
    const budgetId = budgetIdMap.get(expense.budget_id);
    if (!budgetId) continue;
    const itemId = expense.budget_item_id ? itemIdMap.get(expense.budget_item_id) || null : null;
    db.run(
      `INSERT INTO budget_expenses (
        budget_id, budget_item_id, category, title, amount, amount_base, spent_on, note, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        budgetId, itemId, expense.category, expense.title, expense.amount, expense.amount_base ?? null, expense.spent_on, expense.note,
        mapUser(expense.created_by, prodNames, fallbackUser), expense.created_at, expense.updated_at,
      ]
    );
  }

  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  console.log(JSON.stringify({
    dbPath,
    importedTrips: imported,
    replacedTrips: replaced,
    days: payload.trip_days?.length || 0,
    budgets: payload.budgets?.length || 0,
    items: payload.budget_items?.length || 0,
    expenses: payload.budget_expenses?.length || 0,
  }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

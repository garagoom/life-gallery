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

(async () => {
  const SQL = await initSqlJs();
  const file = path.join(__dirname, '..', 'database.sqlite');
  const db = new SQL.Database(fs.readFileSync(file));
  const payload = {
    users: all(db, 'SELECT id, username, role FROM users'),
    trips: all(db, 'SELECT * FROM trips'),
    trip_days: all(db, 'SELECT * FROM trip_days ORDER BY trip_id, sort_order, id'),
    budgets: all(db, 'SELECT * FROM budgets'),
    budget_items: all(db, 'SELECT * FROM budget_items ORDER BY budget_id, sort_order, id'),
    budget_expenses: all(db, 'SELECT * FROM budget_expenses ORDER BY budget_id, id'),
  };
  const out = path.join(__dirname, '..', 'tmp-travel-export.json');
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({
    file,
    out,
    users: payload.users.map((u) => u.username),
    trips: payload.trips.length,
    days: payload.trip_days.length,
    budgets: payload.budgets.length,
    items: payload.budget_items.length,
    expenses: payload.budget_expenses.length,
    titles: payload.trips.map((t) => t.title),
  }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

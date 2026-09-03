const { initDb, getDb } = require('./server/db.cjs');
initDb().then(() => {
  const db = getDb();
  const r = db.exec('SELECT id, parent_id, key, label, type, visible FROM menus ORDER BY sort_order');
  if (r[0]) {
    r[0].values.forEach(row => {
      console.log('id=' + row[0] + ' parent=' + row[1] + ' key=' + row[2] + ' label=' + row[3] + ' type=' + row[4] + ' visible=' + row[5]);
    });
  }
}).catch(e => console.error(e));

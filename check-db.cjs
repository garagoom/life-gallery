const initSqlJs = require('/opt/life-gallery/node_modules/sql.js');
const fs = require('fs');
initSqlJs().then(SQL => {
  const db = new SQL.Database(fs.readFileSync('/opt/life-gallery/database.sqlite'));
  const photos = db.exec('SELECT id, uploaded_by FROM photos LIMIT 5');
  console.log('PHOTOS:', JSON.stringify(photos));
  const users = db.exec('SELECT username, bio, display_name FROM users LIMIT 5');
  console.log('USERS:', JSON.stringify(users));
  db.close();
});

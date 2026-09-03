const initSqlJs = require('/opt/life-gallery/node_modules/sql.js');
const fs = require('fs');

const dbPath = '/opt/life-gallery/database.sqlite';

initSqlJs().then(SQL => {
  const db = new SQL.Database(fs.readFileSync(dbPath));
  
  try { db.run("ALTER TABLE users ADD COLUMN gender TEXT"); console.log('added gender'); } catch(e) { console.log('gender:', e.message); }
  try { db.run("ALTER TABLE users ADD COLUMN bio TEXT"); console.log('added bio'); } catch(e) { console.log('bio:', e.message); }
  try { db.run("UPDATE users SET gender = 'secret' WHERE gender IS NULL"); console.log('backfilled gender'); } catch(e) { console.log(e.message); }
  try { db.run("UPDATE users SET avatar = '/images/avatars/male.svg' WHERE avatar IS NULL"); console.log('backfilled avatar'); } catch(e) { console.log(e.message); }
  
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  console.log('saved');
  db.close();
}).catch(err => { console.error(err); process.exit(1); });

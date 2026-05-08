```sh
node -e "
const { getDb, initDb } = require('./src/utils/db');
initDb().then(() => {
  const db = getDb();
  try { db._raw.run('ALTER TABLE test_runs ADD COLUMN test_url TEXT'); console.log('added test_url'); } catch(e) { console.log('test_url exists'); }
  try { db._raw.run('ALTER TABLE test_runs ADD COLUMN environment TEXT'); console.log('added environment'); } catch(e) { console.log('environment exists'); }
  try { db._raw.run('ALTER TABLE test_runs ADD COLUMN browser TEXT'); console.log('added browser'); } catch(e) { console.log('browser exists'); }
  try { db._raw.run(\`CREATE TABLE IF NOT EXISTS test_run_run_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )\`); console.log('created test_run_run_notes'); } catch(e) { console.log('already exists'); }
  db.close();
  console.log('Migration done');
}).catch(e => console.error(e));
"
```

```sh
node -e "
const { getDb, initDb } = require('./src/utils/db');
initDb().then(() => {
  const db = getDb();
  try { db._raw.run('ALTER TABLE test_runs ADD COLUMN test_url TEXT'); console.log('added test_url'); } catch(e) { console.log('test_url already exists'); }
  try { db._raw.run('ALTER TABLE test_runs ADD COLUMN environment TEXT'); console.log('added environment'); } catch(e) { console.log('environment already exists'); }
  try { db._raw.run('ALTER TABLE test_runs ADD COLUMN browser TEXT'); console.log('added browser'); } catch(e) { console.log('browser already exists'); }
  try { db._raw.run(\`CREATE TABLE IF NOT EXISTS test_run_run_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )\`); console.log('created test_run_run_notes'); } catch(e) { console.log('table already exists'); }
  db.close();
  console.log('Migration done');
}).catch(e => console.error(e));
"
```

```sh
node -e "
const { initDb } = require('./src/utils/db');
const fs = require('fs');
const path = require('path');

initDb().then(() => {
  const initSqlJs = require('sql.js');
  const DB_PATH = path.join(__dirname, 'data/testflow.db');

  initSqlJs().then(SQL => {
    const buf = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buf);

    const migrations = [
      'ALTER TABLE test_runs ADD COLUMN test_url TEXT',
      'ALTER TABLE test_runs ADD COLUMN environment TEXT',
      'ALTER TABLE test_runs ADD COLUMN browser TEXT',
      \`CREATE TABLE IF NOT EXISTS test_run_run_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_run_id INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )\`
    ];

    migrations.forEach(sql => {
      try { db.run(sql); console.log('OK:', sql.slice(0, 40)); }
      catch(e) { console.log('Skip:', e.message.slice(0, 60)); }
    });

    // Save back to disk
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    db.close();
    console.log('Migration saved to disk successfully');
  });
}).catch(e => console.error(e));
"
```
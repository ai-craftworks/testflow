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

```sh
node -e "
const { initDb, getDb } = require('./src/utils/db');
initDb().then(() => {
  const db = getDb();
  db._raw.run(\`CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'bug',
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )\`);
  db._raw.run(\`CREATE TABLE IF NOT EXISTS debug_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    observation TEXT,
    code_snippet TEXT,
    code_language TEXT DEFAULT 'javascript',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )\`);
  db._raw.run(\`CREATE TABLE IF NOT EXISTS test_run_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    UNIQUE(test_run_id, issue_id)
  )\`);
  db.close();
  console.log('Migration done');
}).catch(e => console.error(e));
"
```
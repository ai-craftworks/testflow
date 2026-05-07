const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '../../data/testflow.db');
if (fs.existsSync(DB_PATH)) { fs.unlinkSync(DB_PATH); console.log('🗑️  Database deleted'); }
const { initDb } = require('./db');
initDb().then(() => console.log('✅ Fresh database created')).catch(e => { console.error(e); process.exit(1); });

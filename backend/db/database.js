const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const fs      = require('fs');

const DB_PATH     = path.join(__dirname, '../../database/bookings.db');
const SCHEMA_PATH = path.join(__dirname, '../../database/init.sql');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Run schema on startup — CREATE TABLE IF NOT EXISTS is idempotent
db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  // Split on semicolons to run each statement individually
  schema.split(';').map(s => s.trim()).filter(Boolean).forEach(stmt => {
    db.run(stmt, err => {
      if (err && !err.message.includes('already exists')) {
        console.error('[db] Schema error:', err.message);
      }
    });
  });
});

module.exports = db;

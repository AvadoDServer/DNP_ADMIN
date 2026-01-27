const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/subscriptions.db');

let db;

function getDb() {
  if (!db) {
    const options = process.env.NODE_ENV === 'development' 
      ? { verbose: console.log } 
      : {};
    db = new Database(DB_PATH, options);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initDatabase() {
  const database = getDb();
  
  // Create subscriptions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      subscription_code TEXT NOT NULL UNIQUE,
      plan_type TEXT NOT NULL CHECK(plan_type IN ('monthly', 'yearly')),
      status TEXT NOT NULL CHECK(status IN ('active', 'expired', 'cancelled')) DEFAULT 'active',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      shopify_order_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_user_id ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscription_code ON subscriptions(subscription_code);
    CREATE INDEX IF NOT EXISTS idx_status ON subscriptions(status);

    -- Create subscription codes table for pre-generated codes
    CREATE TABLE IF NOT EXISTS subscription_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      plan_type TEXT NOT NULL CHECK(plan_type IN ('monthly', 'yearly')),
      is_used INTEGER DEFAULT 0,
      shopify_order_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      used_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_code ON subscription_codes(code);
    CREATE INDEX IF NOT EXISTS idx_is_used ON subscription_codes(is_used);

    -- Create audit log table
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
  `);

  console.log('Database initialized successfully');
  return database;
}

module.exports = {
  getDb,
  initDatabase
};

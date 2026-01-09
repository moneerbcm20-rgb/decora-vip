const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'orders.db');

async function init() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  const db = await open({ filename: DB_FILE, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId TEXT,
      status TEXT,
      productType TEXT,
      deliveryDate TEXT,
      data TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

module.exports = { init };

const express = require('express');
const bodyParser = require('body-parser');
const { init } = require('./db.cjs');

const app = express();
const PORT = process.env.SERVER_PORT || 4000;

app.use(bodyParser.json());

let db;

app.post('/orders', async (req, res) => {
  try {
    const orders = req.body.orders || [];
    await db.run('BEGIN TRANSACTION');
    for (const o of orders) {
      await db.run(
        `INSERT INTO orders (orderId, status, productType, deliveryDate, data) VALUES (?, ?, ?, ?, ?)`,
        [o.id || null, o.status || null, o.productType || null, o.deliveryDate || null, JSON.stringify(o)]
      );
    }
    await db.run('COMMIT');
    res.json({ ok: true, inserted: orders.length });
  } catch (err) {
    await db.run('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM orders ORDER BY createdAt DESC LIMIT 100');
    const parsed = rows.map(r => ({ ...r, data: JSON.parse(r.data) }));
    res.json({ ok: true, orders: parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save full application state (customers, orders, productsConfig, expenses, invoices, users)
app.post('/state', async (req, res) => {
  try {
    const { key = 'app', data } = req.body;
    if (!data) return res.status(400).json({ error: 'missing data' });
    await db.run(`INSERT INTO app_state (key, data, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET data=excluded.data, updatedAt=CURRENT_TIMESTAMP`, [key, JSON.stringify(data)]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/state', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM app_state WHERE key = ?', ['app']);
    if (!row) return res.json({ ok: true, data: null });
    res.json({ ok: true, data: JSON.parse(row.data), updatedAt: row.updatedAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

(async () => {
  db = await init();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
})();

const express = require('express');
const bodyParser = require('body-parser');
const { init } = require('./db');

const app = express();
const PORT = process.env.SERVER_PORT || 4000;

app.use(bodyParser.json());

let db;

app.post('/orders', async (req, res) => {
  try {
    const orders = req.body.orders || [];
    const stmt = await db.prepare(`INSERT INTO orders (orderId, status, productType, deliveryDate, data) VALUES (?, ?, ?, ?, ?)`);
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

(async () => {
  db = await init();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
})();

const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications  – for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[Notifications/GET]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Notification not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Notifications/PATCH/:id/read]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications/mark-many-read
router.post('/mark-many-read', authenticate, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ANY($1::uuid[]) AND user_id = $2',
      [ids, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications/mark-many-read]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications  – create notification (internal / admin use)
router.post('/', authenticate, async (req, res) => {
  const { user_id, type, title, message, data } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [user_id, type, title, message || '', JSON.stringify(data || {})]
    );
    const io = req.app.locals.io;
    if (io) io.emit(`notification:${user_id}`, rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Notifications/POST]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications/bulk
router.post('/bulk', authenticate, async (req, res) => {
  const notifications = req.body;
  if (!Array.isArray(notifications)) {
    return res.status(400).json({ error: 'Array of notifications required' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    const io = req.app.locals.io;

    for (const n of notifications) {
      const { rows } = await client.query(
        'INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [n.user_id, n.type, n.title, n.message || '', JSON.stringify(n.data || {})]
      );
      results.push(rows[0]);
      if (io) io.emit(`notification:${n.user_id}`, rows[0]);
    }
    
    await client.query('COMMIT');
    res.status(201).json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Notifications/POST/bulk]', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

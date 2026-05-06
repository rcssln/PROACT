const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/activity-logs?user_id=&limit=
router.get('/', authenticate, async (req, res) => {
  const { user_id, limit = 100 } = req.query;
  try {
    let query = `SELECT al.*, u.first_name, u.last_name, u.email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id`;
    const params = [];
    if (user_id) {
      params.push(user_id);
      query += ` WHERE al.user_id = $1`;
    }
    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[ActivityLogs/GET]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/activity-logs
router.post('/', authenticate, async (req, res) => {
  const { action, details } = req.body;
  if (!action) return res.status(400).json({ error: 'action is required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, action, details || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[ActivityLogs/POST]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/deployments?event_id=
router.get('/', authenticate, async (req, res) => {
  const { event_id } = req.query;
  if (!event_id) return res.status(400).json({ error: 'event_id is required' });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM event_deployments WHERE event_id = $1 ORDER BY created_at DESC',
      [event_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[Deployments/GET]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deployments  – deploy event to LGU cities
router.post('/', authenticate, async (req, res) => {
  const { event_id, province, cities, strength_label, strength_value } = req.body;
  if (!event_id || !cities || !Array.isArray(cities) || cities.length === 0) {
    return res.status(400).json({ error: 'event_id and cities[] are required' });
  }
  try {
    const results = [];
    for (const city of cities) {
      const { rows } = await pool.query(
        `INSERT INTO event_deployments (event_id, city, province, deployed_by, strength_label, strength_value)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (event_id, city) DO UPDATE SET
           strength_label = EXCLUDED.strength_label,
           strength_value = EXCLUDED.strength_value,
           deployed_by = EXCLUDED.deployed_by
         RETURNING *`,
        [event_id, city, province || null, req.user.id, strength_label || 'Standard', strength_value || 1]
      );
      results.push(rows[0]);

      // Notify LGU users in this city
      const lguRes = await pool.query(
        `SELECT id FROM users WHERE city = $1 AND account_type = 'LGU' AND province = $2`,
        [city, province]
      );
      for (const u of lguRes.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, data)
           VALUES ($1,'event_deployment','Event Alert','An event has been deployed to your area.',$2)`,
          [u.id, JSON.stringify({ event_id, city })]
        );
        const io = req.app.locals.io;
        io.emit(`notification:${u.id}`, { type: 'event_deployment', event_id, city });
      }
    }
    res.status(201).json(results);
  } catch (err) {
    console.error('[Deployments/POST]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/deployments/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM event_deployments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[Deployments/DELETE]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

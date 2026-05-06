const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/signals?event_id=
router.get('/', authenticate, async (req, res) => {
  const { event_id } = req.query;
  if (!event_id) return res.status(400).json({ error: 'event_id is required' });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM event_signals WHERE event_id = $1 ORDER BY created_at DESC',
      [event_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[Signals/GET]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/signals/user  – get signal assigned to the current user's city/province
router.get('/user', authenticate, async (req, res) => {
  const user = req.user;
  const { event_id } = req.query;
  if (!event_id) return res.status(400).json({ error: 'event_id is required' });
  try {
    let query, params;
    if (user.account_type === 'Provincial Admin') {
      query = `SELECT signal FROM event_signals WHERE event_id = $1 AND province = $2 AND city IS NULL LIMIT 1`;
      params = [event_id, user.province];
    } else if (user.account_type === 'LGU Admin' || user.account_type === 'LGU') {
      query = `SELECT signal FROM event_signals WHERE event_id = $1 AND city = $2 AND barangay IS NULL LIMIT 1`;
      params = [event_id, user.city];
    } else {
      return res.json({ signal: null });
    }
    const { rows } = await pool.query(query, params);
    res.json({ signal: rows[0]?.signal || null });
  } catch (err) {
    console.error('[Signals/user]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/signals/assign  – assign single signal
router.post('/assign', authenticate, async (req, res) => {
  const { event_id, province, city, barangay, signal } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO event_signals (event_id, province, city, barangay, signal, assigned_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (event_id, province, city, barangay) DO UPDATE SET signal = EXCLUDED.signal, assigned_by = EXCLUDED.assigned_by
       RETURNING *`,
      [event_id, province, city || null, barangay || null, signal, req.user.id]
    );
    const updatedSignal = rows[0];
    const io = req.app.locals.io;
    if (io) io.emit('signal:updated', updatedSignal);

    // Notification Logic
    try {
      let targetTypes = [];
      let userQuery = 'SELECT id FROM users WHERE status = \'Active\'';
      const userParams = [];

      if (!city && !barangay) {
        // Region -> Province
        targetTypes = ['Provincial', 'Provincial Admin'];
        userQuery += ' AND account_type = ANY($1) AND province = $2';
        userParams.push(targetTypes, province);
      } else if (city && !barangay) {
        // Province -> LGU
        targetTypes = ['LGU', 'LGU Admin'];
        userQuery += ' AND account_type = ANY($1) AND city = $2';
        userParams.push(targetTypes, city);
      } else if (barangay) {
        // LGU -> Barangay
        targetTypes = ['LGU', 'LGU Admin'];
        userQuery += ' AND account_type = ANY($1) AND city = $2';
        userParams.push(targetTypes, city);
      }

      const { rows: usersToNotify } = await pool.query(userQuery, userParams);
      if (usersToNotify.length > 0) {
        const { rows: eventRow } = await pool.query('SELECT name FROM events WHERE id = $1', [event_id]);
        const eventName = eventRow[0]?.name || 'Event';
        const locationName = barangay || city || province;
        
        const notifs = usersToNotify.map(u => ({
          user_id: u.id,
          type: 'signal_update',
          title: 'Signal Alert',
          message: `Signal ${signal} has been raised for ${locationName} due to ${eventName}.`,
          data: { event_id, signal, location: locationName }
        }));

        // Use internal bulk notification logic (or just insert)
        for (const n of notifs) {
          const { rows: nRows } = await pool.query(
            'INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1,$2,$3,$4,$5) RETURNING *',
            [n.user_id, n.type, n.title, n.message, JSON.stringify(n.data)]
          );
          if (io) io.emit(`notification:${n.user_id}`, nRows[0]);
        }
      }
    } catch (notifErr) {
      console.error('[Signals/assign] Notification error:', notifErr);
    }

    res.status(201).json(updatedSignal);
  } catch (err) {
    console.error('[Signals/assign]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/signals/clear – clear a signal
router.post('/clear', authenticate, async (req, res) => {
  const { event_id, province, city, barangay } = req.body;
  try {
    let query = 'DELETE FROM event_signals WHERE event_id = $1 AND province = $2';
    const params = [event_id, province];
    
    if (city) {
      query += ' AND city = $3';
      params.push(city);
    } else {
      query += ' AND city IS NULL';
    }

    if (barangay) {
      query += ' AND barangay = $' + (params.length + 1);
      params.push(barangay);
    } else {
      query += ' AND barangay IS NULL';
    }

    await pool.query(query, params);
    const io = req.app.locals.io;
    if (io) io.emit('signal:cleared', { event_id, province, city, barangay });
    res.json({ success: true });
  } catch (err) {
    console.error('[Signals/clear]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/signals/bulk-assign
router.post('/bulk-assign', authenticate, async (req, res) => {
  const { assignments } = req.body;
  if (!assignments || !Array.isArray(assignments)) {
    return res.status(400).json({ error: 'assignments array is required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    const io = req.app.locals.io;

    for (const a of assignments) {
      const { rows } = await client.query(
        `INSERT INTO event_signals (event_id, province, city, barangay, signal, assigned_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (event_id, province, city, barangay) DO UPDATE SET signal = EXCLUDED.signal, assigned_by = EXCLUDED.assigned_by
         RETURNING *`,
        [a.event_id, a.province, a.city || null, a.barangay || null, a.signal, req.user.id]
      );
      results.push(rows[0]);
    }
    
    await client.query('COMMIT');
    if (io) io.emit('signals:bulk-updated', results);
    res.status(201).json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Signals/bulk-assign]', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

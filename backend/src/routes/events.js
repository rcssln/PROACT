const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/events
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;
    let query = 'SELECT * FROM events';
    const params = [];

    // Scope: LGU/Provincial Admins only see events where they have a signal OR event is deployed
    if (user.account_type === 'Provincial Admin') {
      const signals = await pool.query(
        'SELECT event_id FROM event_signals WHERE province = $1 AND city IS NULL',
        [user.province]
      );
      const ids = signals.rows.map(r => r.event_id);
      if (ids.length > 0) {
        query += ` WHERE id = ANY($1::uuid[]) OR is_deployed = TRUE`;
        params.push(ids);
      } else {
        query += ` WHERE is_deployed = TRUE`;
      }
    } else if (user.account_type === 'LGU Admin' || user.account_type === 'LGU') {
      const signals = await pool.query(
        'SELECT event_id FROM event_signals WHERE city = $1 AND barangay IS NULL',
        [user.city]
      );
      const ids = signals.rows.map(r => r.event_id);
      if (ids.length > 0) {
        query += ` WHERE id = ANY($1::uuid[]) OR is_deployed = TRUE`;
        params.push(ids);
      } else {
        query += ` WHERE is_deployed = TRUE`;
      }
    }

    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[Events/GET]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/events/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Events/GET/:id]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events
router.post('/', authenticate, async (req, res) => {
  const { name, color, start_date, end_date, event_type, alert_status, alert_level,
    pinged_report_types, summary, affected_provinces } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO events (name, color, start_date, end_date, event_type, alert_status,
        alert_level, pinged_report_types, summary, affected_provinces)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, color, start_date || null, end_date || null, event_type, alert_status,
        alert_level || null, JSON.stringify(pinged_report_types || []),
        summary || '', affected_provinces || []] // Don't stringify affected_provinces!
    );
    const io = req.app.locals.io;
    io.emit('events:created', rows[0]);

    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Created new event', `Event: ${rows[0].name}`]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Events/POST]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/events/:id
router.patch('/:id', authenticate, async (req, res) => {
  const fields = req.body;
  const allowed = ['name','color','start_date','end_date','event_type','alert_status',
    'alert_level','pinged_report_types','summary','affected_provinces',
    'approval_status','approved_pdf_url','is_deployed','deployed_at','deployed_snapshot'];

  const setClauses = [];
  const values = [];
  let idx = 1;

  const jsonFields = ['pinged_report_types', 'deployed_snapshot'];

  // --- ONE EVENT DEPLOYMENT ONLY LOGIC ---
  // If this event is being deployed, undeploy all others first
  if (fields.is_deployed === true) {
    try {
      await pool.query('UPDATE events SET is_deployed = FALSE WHERE id <> $1', [req.params.id]);
    } catch (err) {
      console.error('[Events/PATCH] Failed to undeploy other events:', err);
      return res.status(500).json({ error: 'Failed to undeploy other events' });
    }
  }

  for (const [key, val] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      setClauses.push(`${key} = $${idx}`);
      // Only stringify JSONB fields, let pg handle the rest (including TEXT[] arrays)
      values.push(jsonFields.includes(key) && val !== null ? JSON.stringify(val) : val);
      idx++;
    }
  }

  if (setClauses.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  values.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE events SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });

    const io = req.app.locals.io;
    // Notify clients that other events might have been undeployed too
    io.emit('events:updated', rows[0]);
    // We should probably broadcast to all clients to refresh their list if we undeployed others
    if (fields.is_deployed === true) {
      io.emit('events:refresh_needed'); 
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[Events/PATCH]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/events/:id
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Cascading delete is better handled by DB constraints, but we can do it manually for safety
    const childTables = [
      'agriculture_damage_reports',
      'assistance_lgus_agencies_reports',
      'assistance_provided_reports',
      'class_suspension_reports',
      'communication_lines_reports',
      'damaged_houses_reports',
      'declaration_state_of_calamity_reports',
      'infrastructure_damage_reports',
      'power_reports',
      'pre_emptive_evacuation_reports',
      'related_incidents',
      'reports',
      'roads_and_bridges',
      'water_supply_reports',
      'work_suspension_reports',
      'event_deployments',
      'situational_reports'
    ];

    for (const table of childTables) {
      await client.query(`DELETE FROM ${table} WHERE event_id = $1`, [id]);
    }

    await client.query('DELETE FROM events WHERE id = $1', [id]);
    await client.query('COMMIT');
    
    const io = req.app.locals.io;
    io.emit('events:deleted', { id });
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Events/DELETE]', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

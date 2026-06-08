const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Simple ping route
router.get('/ping', (req, res) => res.json({ message: 'settings route is active' }));

// Middleware to ensure settings table exists
const ensureSettingsTable = async (req, res, next) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.settings (
        id UUID PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        key TEXT NOT NULL UNIQUE,
        value JSONB NOT NULL DEFAULT '{}'::JSONB,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    next();
  } catch (err) {
    console.error('[Settings] Table initialization error:', err);
    next();
  }
};

// Check Super Admin
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'Super Admin' && req.user.account_type !== 'Super Admin') {
    return res.status(403).json({ error: 'Forbidden. Super Admin access required.' });
  }
  next();
};

// GET /api/settings/smtp
router.get('/smtp', authenticate, requireSuperAdmin, ensureSettingsTable, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', ['smtp_config']);
    if (rows.length > 0) {
      res.json(rows[0].value);
    } else {
      res.json({
        provider: 'Outlook',
        senderEmail: '',
        host: 'smtp.office365.com',
        port: 587,
        username: '',
        password: ''
      });
    }
  } catch (err) {
    console.error('[Settings/GET smtp]', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// PUT /api/settings/smtp
router.put('/smtp', authenticate, requireSuperAdmin, ensureSettingsTable, async (req, res) => {
  const { provider, senderEmail, host, port, username, password } = req.body;
  try {
    const config = { provider, senderEmail, host, port, username, password };
    await pool.query(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES ('smtp_config', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [JSON.stringify(config)]);
    res.json({ success: true, config });
  } catch (err) {
    console.error('[Settings/PUT smtp]', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;

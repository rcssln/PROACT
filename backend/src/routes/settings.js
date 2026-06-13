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

// GET /api/settings/smtp-logs
router.get('/smtp-logs', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT al.*, u.first_name, u.last_name, u.email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.action = 'SMTP_CONFIG_UPDATED'
      ORDER BY al.created_at DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    console.error('[Settings/GET smtp/logs]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

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

// GET /api/settings/ai (Accessible by any authenticated user for summary generation)
router.get('/ai', authenticate, ensureSettingsTable, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', ['ai_config']);
    let config = rows.length > 0 ? rows[0].value : { activeModel: 'groq' };

    // Aggressive fallback to .env if DB keys are missing/empty
    if (!config.geminiKey) config.geminiKey = process.env.VITE_GEMINI_API_KEY || '';
    if (!config.groqKey) config.groqKey = process.env.VITE_GROQ_API_KEY || '';
    if (!config.activeModel) config.activeModel = 'groq';

    res.json(config);
  } catch (err) {
    console.error('[Settings/GET ai]', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// PUT /api/settings/ai (Super Admin only)
router.put('/ai', authenticate, requireSuperAdmin, ensureSettingsTable, async (req, res) => {
  const { activeModel, geminiKey, groqKey } = req.body;
  try {
    const config = { activeModel, geminiKey, groqKey };
    
    // Mask keys for logging
    const maskedConfig = { 
      activeModel, 
      geminiKey: geminiKey ? '••••••••' : '', 
      groqKey: groqKey ? '••••••••' : '' 
    };

    await pool.query('BEGIN');
    
    await pool.query(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES ('ai_config', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [JSON.stringify(config)]);

    // Log the activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'AI_CONFIG_UPDATED', JSON.stringify(maskedConfig)]
    );

    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[Settings/PUT ai]', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// PUT /api/settings/smtp
router.put('/smtp', authenticate, requireSuperAdmin, ensureSettingsTable, async (req, res) => {
  const { provider, senderName, senderEmail, host, port, username, password } = req.body;
  try {
    const config = { provider, senderName, senderEmail, host, port, username, password };
    
    // Mask password for logging
    const maskedConfig = { ...config, password: '••••••••' };

    await pool.query('BEGIN');
    
    await pool.query(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES ('smtp_config', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [JSON.stringify(config)]);

    // Log the activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'SMTP_CONFIG_UPDATED', JSON.stringify(maskedConfig)]
    );

    await pool.query('COMMIT');
    
    res.json({ success: true, config });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[Settings/PUT smtp]', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/settings/weather
router.get('/weather', authenticate, ensureSettingsTable, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', ['weather_config']);
    if (rows.length > 0) {
      res.json(rows[0].value);
    } else {
      res.json({ condition: 'Clear Skies', icon: 'Sun' });
    }
  } catch (err) {
    console.error('[Settings/GET weather]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/settings/weather (Super Admin only)
router.put('/weather', authenticate, requireSuperAdmin, ensureSettingsTable, async (req, res) => {
  const { condition, icon } = req.body;
  try {
    const config = { condition, icon };
    await pool.query(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES ('weather_config', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [JSON.stringify(config)]);

    const io = req.app.locals.io;
    if (io) io.emit('weather:updated', config);

    res.json({ success: true, config });
  } catch (err) {
    console.error('[Settings/PUT weather]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

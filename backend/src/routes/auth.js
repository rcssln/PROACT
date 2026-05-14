const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];

    if (user.status === 'Pending') {
      return res.status(403).json({ error: 'Your account is pending approval' });
    }

    if (user.status === 'Inactive') {
      return res.status(403).json({ error: 'Your account is inactive' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        account_type: user.account_type,
        province: user.province,
        city: user.city,
        must_change_password: user.must_change_password
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user without password_hash
    const { password_hash, ...safeUser } = user;

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('[Auth/login] ERROR:', err.message);
    console.error('[Auth/login] STACK:', err.stack);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// GET /api/auth/me  – verify token and return current user
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { rows } = await pool.query(
      'SELECT id, email, first_name, last_name, phone, city, role, status, created_at, account_type, province, must_change_password, theme FROM users WHERE id = $1',
      [decoded.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('[Auth/me] Server error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const { authenticate } = require('../middleware/auth');

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ error: 'Missing new password' });
  }

  try {
    const { rows } = await pool.query('SELECT password_hash, must_change_password FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = rows[0];

    // If they are NOT in a forced-change state, they MUST provide the current password
    if (!user.must_change_password) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
      const isValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2',
      [hash, req.user.id]
    );

    // Activity log
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Changed password', 'User changed password via settings']
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth/change-password]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

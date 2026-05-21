const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../utils/mailer');

const router = express.Router();

// GET /api/users  – scoped by account_type
router.get('/', authenticate, async (req, res) => {
  const user = req.user;
  try {
    let query = `SELECT id, email, first_name, last_name, phone, city, role, status,
      created_at, account_type, province, must_change_password, theme FROM users`;
    const params = [];
    const conditions = [];

    if (user.account_type === 'Provincial Admin') {
      conditions.push(`province = $${params.length + 1}`);
      params.push(user.province);
      conditions.push(`account_type = ANY($${params.length + 1}::text[])`);
      params.push(['Provincial Admin','Provincial Approver','Provincial','LGU Admin','LGU','LGU Approver']);
    } else if (user.account_type === 'LGU Admin') {
      conditions.push(`city = $${params.length + 1}`);
      params.push(user.city);
      conditions.push(`account_type = ANY($${params.length + 1}::text[])`);
      params.push(['LGU Admin','LGU','LGU Approver']);
    }
    // Regional Admin / Super Admin → all users

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[Users/GET]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/pending-count
router.get('/pending-count', authenticate, async (req, res) => {
  const user = req.user;
  try {
    let query = `SELECT COUNT(*) AS count FROM users WHERE (status = 'Pending' OR must_change_password = TRUE)`;
    const params = [];

    if (user.account_type === 'Provincial Admin') {
      query += ` AND province = $1 AND account_type = ANY($2::text[])`;
      params.push(user.province, ['Provincial Admin','Provincial Approver','Provincial','LGU Admin','LGU','LGU Approver']);
    } else if (user.account_type === 'LGU Admin') {
      query += ` AND city = $1 AND account_type = ANY($2::text[])`;
      params.push(user.city, ['LGU Admin','LGU','LGU Approver']);
    }

    const { rows } = await pool.query(query, params);
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) {
    console.error('[Users/pending-count]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users  – create user
router.post('/', authenticate, async (req, res) => {
  const { email, first_name, last_name, phone, city, province, account_type, role, password, status } = req.body;
  if (!email || !first_name || !last_name) {
    return res.status(400).json({ error: 'email, first_name, and last_name are required' });
  }
  try {
    let tempPassword = password;
    if (!tempPassword) {
      // Generate random 12-char password
      tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    }
    const hash = await bcrypt.hash(tempPassword, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, first_name, last_name, phone, city, province, account_type, role, password_hash, status, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, TRUE) RETURNING id, email, first_name, last_name, phone, city, role, status, created_at, account_type, province, must_change_password, theme`,
      [email.toLowerCase().trim(), first_name, last_name, phone || '', city || '', province || '', account_type || 'LGU', role || 'Viewer', hash, status || 'Active']
    );

    const user = rows[0];
    
    // Attempt to send email
    const emailResult = await sendWelcomeEmail(user.email, user.first_name, tempPassword);
    
    res.status(201).json({ 
      ...user, 
      tempPassword, 
      emailSent: emailResult.success,
      emailError: emailResult.error 
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error('[Users/POST]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/:id
router.patch('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { 
    first_name, last_name, phone, city, province, 
    account_type, role, status, theme, password 
  } = req.body;

  console.log(`[Users/PATCH] Updating user ${id}...`);
  
  try {
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    // Simpler, safer update query
    const fields = [];
    const values = [];

    if (first_name) { fields.push(`first_name = $${fields.length + 1}`); values.push(first_name); }
    if (last_name) { fields.push(`last_name = $${fields.length + 1}`); values.push(last_name); }
    if (phone) { fields.push(`phone = $${fields.length + 1}`); values.push(phone); }
    if (city) { fields.push(`city = $${fields.length + 1}`); values.push(city); }
    if (province) { fields.push(`province = $${fields.length + 1}`); values.push(province); }
    if (account_type) { fields.push(`account_type = $${fields.length + 1}`); values.push(account_type); }
    if (role) { fields.push(`role = $${fields.length + 1}`); values.push(role); }
    if (status) { fields.push(`status = $${fields.length + 1}`); values.push(status); }
    if (theme) { fields.push(`theme = $${fields.length + 1}`); values.push(theme); }
    if (passwordHash) { fields.push(`password_hash = $${fields.length + 1}`); values.push(passwordHash); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING id, email, first_name, last_name, phone, city, role, status, created_at, account_type, province, must_change_password, theme`;

    console.log('[Users/PATCH] Executing query...');
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) {
      console.warn(`[Users/PATCH] No user found with ID: ${id}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[Users/PATCH] Successfully updated user ${id}`);
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('[Users/PATCH] DATABASE ERROR:', err.message);
    res.status(500).json({ error: 'Update failed: ' + err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[Users/DELETE]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

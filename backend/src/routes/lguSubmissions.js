const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper: send socket notification
function emitNotification(req, userId, notification) {
  const io = req.app.locals.io;
  if (io) {
    io.emit(`notification:${userId}`, notification);
  }
}

// Helper for robust city comparison in SQL
const cityCondition = (tableAlias, paramIndex) => {
  return `REGEXP_REPLACE(${tableAlias}.city, '\\s*\\(.*\\)\\s*$', '') = $${paramIndex}`;
};

// GET /status  – get status of an LGU submission for a SitRep
router.get('/status', authenticate, async (req, res) => {
  const { situational_report_id, city } = req.query;
  if (!situational_report_id || !city) {
    return res.status(400).json({ error: 'situational_report_id and city are required' });
  }

  try {
    const cleanCity = city.replace(/\s*\(.*\)\s*$/, '').trim();
    const { rows } = await pool.query(
      `SELECT * FROM lgu_submissions WHERE situational_report_id = $1 AND (${cityCondition('lgu_submissions', 2)} OR city = $3)`,
      [situational_report_id, cleanCity, city]
    );

    if (rows.length === 0) {
      return res.json({ status: 'Draft', rejection_remarks: null });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[LguSubmissions/status]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /submit – submit LGU data for LGU Approver review
router.post('/submit', authenticate, async (req, res) => {
  const { situational_report_id, city } = req.body;
  if (!situational_report_id || !city) {
    return res.status(400).json({ error: 'situational_report_id and city are required' });
  }

  try {
    // Upsert submission status to 'Pending LGU Approval'
    // We use the city provided in the request (which might have the suffix)
    const { rows } = await pool.query(
      `INSERT INTO lgu_submissions (situational_report_id, city, status, submitted_by, updated_at, rejection_remarks)
       VALUES ($1, $2, 'Pending LGU Approval', $3, NOW(), NULL)
       ON CONFLICT (situational_report_id, city) 
       DO UPDATE SET status = 'Pending LGU Approval', submitted_by = $3, updated_at = NOW(), rejection_remarks = NULL
       RETURNING *`,
      [situational_report_id, city, req.user.id]
    );

    const submission = rows[0];

    // Find and notify LGU Approver(s) of the same city
    const cleanCity = city.replace(/\s*\(.*\)\s*$/, '').trim();
    const { rows: approvers } = await pool.query(
      `SELECT id FROM users WHERE (${cityCondition('users', 1)} OR city = $2) AND account_type = 'LGU Approver' AND status = 'Active'`,
      [cleanCity, city]
    );

    const io = req.app.locals.io;
    for (const approver of approvers) {
      const notifData = {
        user_id: approver.id,
        type: 'lgu_submission',
        title: 'New LGU Submission for Review',
        message: `LGU data for ${city} has been submitted for your approval.`,
        data: JSON.stringify({ situational_report_id, city })
      };

      const { rows: insertedNotif } = await pool.query(
        'INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [notifData.user_id, notifData.type, notifData.title, notifData.message, notifData.data]
      );

      if (io) io.emit(`notification:${approver.id}`, insertedNotif[0]);
    }

    res.json(submission);
  } catch (err) {
    console.error('[LguSubmissions/submit]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /approve – LGU Approver approves LGU data
router.post('/approve', authenticate, async (req, res) => {
  const { situational_report_id, city } = req.body;
  if (!situational_report_id || !city) {
    return res.status(400).json({ error: 'situational_report_id and city are required' });
  }

  // Ensure user has permissions (LGU Approver of the same city, or Super Admin)
  const isSuperAdmin = req.user.role === 'Super Admin' || req.user.account_type === 'Super Admin';
  if (req.user.account_type !== 'LGU Approver' && !isSuperAdmin) {
    return res.status(403).json({ error: 'Only LGU Approvers can approve submissions' });
  }

  const cleanUserCity = (req.user.city || '').replace(/\s*\(.*\)\s*$/, '').trim();
  const cleanTargetCity = city.replace(/\s*\(.*\)\s*$/, '').trim();

  if (!isSuperAdmin && cleanUserCity !== cleanTargetCity) {
    return res.status(403).json({ error: 'You can only approve submissions for your own city' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO lgu_submissions (situational_report_id, city, status, approved_by, updated_at, rejection_remarks)
       VALUES ($1, $2, 'Approved', $3, NOW(), NULL)
       ON CONFLICT (situational_report_id, city) 
       DO UPDATE SET status = 'Approved', approved_by = $3, updated_at = NOW(), rejection_remarks = NULL
       RETURNING *`,
      [situational_report_id, city, req.user.id]
    );

    const submission = rows[0];

    // Notify LGU and LGU Admin users of the same city
    const cleanCity = city.replace(/\s*\(.*\)\s*$/, '').trim();
    const { rows: lguUsers } = await pool.query(
      `SELECT id FROM users WHERE (${cityCondition('users', 1)} OR city = $2) AND account_type IN ('LGU', 'LGU Admin') AND status = 'Active'`,
      [cleanCity, city]
    );

    const io = req.app.locals.io;
    for (const u of lguUsers) {
      const notifData = {
        user_id: u.id,
        type: 'lgu_approval',
        title: 'LGU Submission Approved',
        message: `Your LGU data submission for ${city} has been approved.`,
        data: JSON.stringify({ situational_report_id, city })
      };

      const { rows: insertedNotif } = await pool.query(
        'INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [notifData.user_id, notifData.type, notifData.title, notifData.message, notifData.data]
      );

      if (io) io.emit(`notification:${u.id}`, insertedNotif[0]);
    }

    // Also notify Provincial users of the same province so they can consolidate it
    const { rows: reportRows } = await pool.query(
      'SELECT province FROM situational_reports WHERE id = $1',
      [situational_report_id]
    );
    if (reportRows.length > 0 && reportRows[0].province) {
      const reportProvince = reportRows[0].province;
      const { rows: provincialUsers } = await pool.query(
        "SELECT id FROM users WHERE province = $1 AND account_type IN ('Provincial', 'Provincial Admin') AND status = 'Active'",
        [reportProvince]
      );
      for (const pu of provincialUsers) {
        const notifData = {
          user_id: pu.id,
          type: 'lgu_approval_provincial',
          title: 'LGU Data Approved',
          message: `${city} data is approved and ready for consolidation.`,
          data: JSON.stringify({ situational_report_id, city })
        };

        const { rows: insertedNotif } = await pool.query(
          'INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [notifData.user_id, notifData.type, notifData.title, notifData.message, notifData.data]
        );

        if (io) io.emit(`notification:${pu.id}`, insertedNotif[0]);
      }
    }

    res.json(submission);
  } catch (err) {
    console.error('[LguSubmissions/approve]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /reject – LGU Approver rejects LGU data
router.post('/reject', authenticate, async (req, res) => {
  const { situational_report_id, city, rejection_remarks } = req.body;
  if (!situational_report_id || !city) {
    return res.status(400).json({ error: 'situational_report_id and city are required' });
  }

  // Ensure user has permissions (LGU Approver of the same city, or Super Admin)
  const isSuperAdmin = req.user.role === 'Super Admin' || req.user.account_type === 'Super Admin';
  if (req.user.account_type !== 'LGU Approver' && !isSuperAdmin) {
    return res.status(403).json({ error: 'Only LGU Approvers can reject submissions' });
  }
  
  const cleanUserCity = (req.user.city || '').replace(/\s*\(.*\)\s*$/, '').trim();
  const cleanTargetCity = city.replace(/\s*\(.*\)\s*$/, '').trim();

  if (!isSuperAdmin && cleanUserCity !== cleanTargetCity) {
    return res.status(403).json({ error: 'You can only reject submissions for your own city' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO lgu_submissions (situational_report_id, city, status, approved_by, updated_at, rejection_remarks)
       VALUES ($1, $2, 'Rejected', $3, NOW(), $4)
       ON CONFLICT (situational_report_id, city) 
       DO UPDATE SET status = 'Rejected', approved_by = $3, updated_at = NOW(), rejection_remarks = $4
       RETURNING *`,
      [situational_report_id, city, req.user.id, rejection_remarks || '']
    );

    const submission = rows[0];

    // Notify LGU and LGU Admin users of the same city
    const cleanCity = city.replace(/\s*\(.*\)\s*$/, '').trim();
    const { rows: lguUsers } = await pool.query(
      `SELECT id FROM users WHERE (${cityCondition('users', 1)} OR city = $2) AND account_type IN ('LGU', 'LGU Admin') AND status = 'Active'`,
      [cleanCity, city]
    );

    const io = req.app.locals.io;
    for (const u of lguUsers) {
      const notifData = {
        user_id: u.id,
        type: 'lgu_rejection',
        title: 'LGU Submission Rejected',
        message: `Your LGU data submission for ${city} was rejected. Remarks: ${rejection_remarks || 'None'}`,
        data: JSON.stringify({ situational_report_id, city, rejection_remarks })
      };

      const { rows: insertedNotif } = await pool.query(
        'INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [notifData.user_id, notifData.type, notifData.title, notifData.message, notifData.data]
      );

      if (io) io.emit(`notification:${u.id}`, insertedNotif[0]);
    }

    res.json(submission);
  } catch (err) {
    console.error('[LguSubmissions/reject]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /pending – get pending reports list for LGU Approver's city
router.get('/pending', authenticate, async (req, res) => {
  const isSuperAdmin = req.user.role === 'Super Admin' || req.user.account_type === 'Super Admin';
  const city = req.user.city;
  
  if (!city && !isSuperAdmin) {
    return res.status(400).json({ error: 'User does not have an assigned city' });
  }

  try {
    let query = `
      SELECT ls.*, sr.title as report_title, e.name as event_name, sr.created_at as report_created_at, sr.province
      FROM lgu_submissions ls
      INNER JOIN situational_reports sr ON ls.situational_report_id = sr.id
      INNER JOIN events e ON sr.event_id = e.id
      WHERE ls.status = 'Pending LGU Approval'
    `;
    const params = [];
    if (!isSuperAdmin) {
      const cleanCity = city.replace(/\s*\(.*\)\s*$/, '').trim();
      params.push(cleanCity);
      query += ` AND (${cityCondition('ls', params.length)} OR ls.city = '${city}')`;
    }

    query += ' ORDER BY ls.updated_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[LguSubmissions/pending]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /pending-count – count of pending reports for LGU Approver's city
router.get('/pending-count', authenticate, async (req, res) => {
  const isSuperAdmin = req.user.role === 'Super Admin' || req.user.account_type === 'Super Admin';
  const city = req.user.city;

  if (!city && !isSuperAdmin) {
    return res.json({ count: 0 });
  }

  try {
    let query = "SELECT COUNT(*) as count FROM lgu_submissions WHERE status = 'Pending LGU Approval'";
    const params = [];
    
    if (!isSuperAdmin) {
      const cleanCity = city.replace(/\s*\(.*\)\s*$/, '').trim();
      params.push(cleanCity);
      query += ` AND (${cityCondition('lgu_submissions', params.length)} OR city = '${city}')`;
    }

    const { rows } = await pool.query(query, params);
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) {
    console.error('[LguSubmissions/pending-count]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /list – get list of statuses for all LGUs for a SitRep
router.get('/list', authenticate, async (req, res) => {
  const { situational_report_id } = req.query;
  if (!situational_report_id) {
    return res.status(400).json({ error: 'situational_report_id is required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT city, status, rejection_remarks, updated_at FROM lgu_submissions WHERE situational_report_id = $1',
      [situational_report_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[LguSubmissions/list]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Generic helper – handles all 13 report sub-tables + reports/report_rows
const ALLOWED_TABLES = new Set([
  'related_incidents',
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
  'roads_and_bridges',
  'water_supply_reports',
  'work_suspension_reports',
  'reports',
  'report_rows',
  'roads_and_bridges_sections',
  'affected_population_reports'
]);

// Helper for robust city comparison in SQL
const cityCondition = (tableAlias, paramIndex) => {
  return `REGEXP_REPLACE(${tableAlias}.city, '\\s*\\(.*\\)\\s*$', '') = $${paramIndex}`;
};

// GET /api/reports/all-types?situational_report_id=
router.get('/all-types', authenticate, async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const { situational_report_id } = req.query;
  const user = req.user;
  
  console.log('---------------------------------------------------------');
  console.log(`[TRACE] /all-types | User: ${user.email} | Role: ${user.account_type}`);
  console.log(`[TRACE] SitRep ID: ${situational_report_id}`);

  if (!situational_report_id) return res.status(400).json({ error: 'situational_report_id is required' });

  const isRegional = ['Regional Admin', 'Regional', 'Super Admin', 'Regional Approver'].includes(user.account_type) || user.role === 'Super Admin';
  const isLgu = ['LGU', 'LGU Admin', 'LGU Approver'].includes(user.account_type);
  const isProvincial = ['Provincial', 'Provincial Admin', 'Provincial Approver'].includes(user.account_type);

  try {
    const tables = [
      { name: 'related_incidents', id: 'incidents' },
      { name: 'agriculture_damage_reports', id: 'agriculture' },
      { name: 'assistance_lgus_agencies_reports', id: 'assistance_lgus' },
      { name: 'assistance_provided_reports', id: 'assistance' },
      { name: 'class_suspension_reports', id: 'class' },
      { name: 'communication_lines_reports', id: 'communication' },
      { name: 'damaged_houses_reports', id: 'houses' },
      { name: 'declaration_state_of_calamity_reports', id: 'calamity' },
      { name: 'infrastructure_damage_reports', id: 'infrastructure' },
      { name: 'power_reports', id: 'power' },
      { name: 'pre_emptive_evacuation_reports', id: 'preemptive' },
      { name: 'roads_and_bridges', id: 'roads' },
      { name: 'water_supply_reports', id: 'water' },
      { name: 'work_suspension_reports', id: 'work' }
    ];

    const results = [];

    await Promise.all(tables.map(async (table) => {
      let query = `SELECT t.* FROM ${table.name} t`;
      const conditions = [`t.situational_report_id = $1`];
      const params = [situational_report_id];

      if (!isRegional) {
        if (isLgu && user.city) {
          const cleanCity = user.city.replace(/\s*\(.*\)\s*$/, '').trim();
          params.push(cleanCity);
          conditions.push(cityCondition('t', params.length));
        } else if (user.province) {
          query += ` INNER JOIN situational_reports sr ON t.situational_report_id = sr.id`;
          params.push(user.province);
          // Allow seeing own province OR Regional reports
          conditions.push(`(sr.province = $${params.length} OR sr.province IS NULL OR sr.province = 'Region 1')`);
        }
      }

      const { rows } = await pool.query(`${query} WHERE ${conditions.join(' AND ')}`, params);
      if (rows.length > 0) console.log(`[TRACE] Table ${table.name}: Found ${rows.length} rows`);
      
      rows.forEach(r => {
        results.push({
          ...r,
          category: table.id,
          tableName: table.name,
          timestamp: r.created_at || new Date()
        });
      });
    }));

    // Affected Population (reports -> report_rows)
    console.log(`[TRACE] Checking 'reports' table for SitRep ${situational_report_id}...`);
    const { rows: reports } = await pool.query('SELECT id, created_at FROM reports WHERE situational_report_id = $1', [situational_report_id]);
    console.log(`[TRACE] Found ${reports.length} parent reports`);

    if (reports.length > 0) {
      const reportIds = reports.map(r => r.id);
      let rowsQuery = `SELECT t.*, r.situational_report_id, r.created_at as parent_created_at FROM report_rows t INNER JOIN reports r ON t.report_id = r.id`;
      const rowsConditions = [`t.report_id = ANY($1::uuid[])`];
      const rowsParams = [reportIds];

      if (!isRegional) {
        if (isLgu && user.city) {
          const cleanCity = user.city.replace(/\s*\(.*\)\s*$/, '').trim();
          rowsParams.push(cleanCity);
          rowsConditions.push(cityCondition('t', rowsParams.length));
        }
      }

      const { rows: reportRows } = await pool.query(`${rowsQuery} WHERE ${rowsConditions.join(' AND ')}`, rowsParams);
      console.log(`[TRACE] Found ${reportRows.length} report_rows`);
      
      reportRows.forEach(r => {
        results.push({
          ...r,
          category: 'evacuation',
          tableName: 'reports',
          report_id: r.report_id,
          timestamp: r.created_at || r.parent_created_at || new Date()
        });
      });
    }

    console.log(`[TRACE] /all-types | Returning total ${results.length} items`);
    console.log('---------------------------------------------------------');
    res.json(results);
  } catch (err) {
    console.error('[TRACE] /all-types ERROR:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/consolidated
router.get('/consolidated', authenticate, async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const { event_id, situational_report_ids } = req.query;
  if (!event_id) return res.status(400).json({ error: 'event_id is required' });

  try {
    const tables = [
      'reports', 'related_incidents', 'roads_and_bridges', 'power_reports',
      'water_supply_reports', 'communication_lines_reports', 'damaged_houses_reports',
      'class_suspension_reports', 'work_suspension_reports', 'declaration_state_of_calamity_reports',
      'pre_emptive_evacuation_reports', 'assistance_provided_reports', 'assistance_lgus_agencies_reports',
      'agriculture_damage_reports', 'infrastructure_damage_reports'
    ];

    const rawData = {};
    const sitRepIds = (typeof situational_report_ids === 'string')
      ? situational_report_ids.split(',').map(id => id.trim()).filter(id => id !== '')
      : [];

    if (typeof situational_report_ids === 'string' && sitRepIds.length === 0) {
      return res.json({ categoryTotals: {}, byCityCategory: {}, details: {}, data: [] });
    }

    const user = req.user;
    const isRegional = ['Regional Admin', 'Regional', 'Super Admin', 'Regional Approver'].includes(user.account_type) || user.role === 'Super Admin';
    const isLgu = ['LGU', 'LGU Admin', 'LGU Approver'].includes(user.account_type);
    const isProvincial = ['Provincial', 'Provincial Admin', 'Provincial Approver'].includes(user.account_type);

    await Promise.all(tables.map(async (table) => {
      let baseQuery = `SELECT t.*, sr.province FROM ${table} t INNER JOIN situational_reports sr ON t.situational_report_id = sr.id`;
      const conditions = [`t.event_id = $1`];
      const params = [event_id];

      if (!isRegional) {
        if (isLgu && user.city) {
          if (table !== 'reports') {
            params.push(user.city.replace(/\s*\(.*\)\s*$/, '').trim());
            conditions.push(cityCondition('t', params.length));
          }
        } else if (user.province) {
          params.push(user.province);
          conditions.push(`(sr.province = $${params.length} OR sr.province IS NULL)`);
        }

        if (!isLgu && !isProvincial && table !== 'reports') {
          conditions.push(`(t.city IS NULL OR t.city = '' OR EXISTS (
            SELECT 1 FROM lgu_submissions ls 
            WHERE ls.situational_report_id = t.situational_report_id 
              AND REGEXP_REPLACE(ls.city, '\\s*\\(.*\\)\\s*$/, '') = REGEXP_REPLACE(t.city, '\\s*\\(.*\\)\\s*$', '')
              AND ls.status = 'Approved'
          ))`);
        }
      }

      if (sitRepIds.length > 0) {
        params.push(sitRepIds);
        conditions.push(`t.situational_report_id = ANY($${params.length}::uuid[])`);
      }

      const { rows } = await pool.query(`${baseQuery} WHERE ${conditions.join(' AND ')}`, params);

      if (table === 'reports' && rows.length > 0) {
        const reportIds = rows.map(r => r.id);
        let rrQuery = `SELECT rr.*, r.situational_report_id FROM report_rows rr INNER JOIN reports r ON rr.report_id = r.id WHERE rr.report_id = ANY($1::uuid[])`;
        const rrParams = [reportIds];
        
        if (!isRegional) {
          if (isLgu && user.city) {
            rrParams.push(user.city.replace(/\s*\(.*\)\s*$/, '').trim());
            rrQuery += ` AND ${cityCondition('rr', rrParams.length)}`;
          } else if (!isLgu && !isProvincial) {
            rrQuery += ` AND (rr.city IS NULL OR rr.city = '' OR EXISTS (
              SELECT 1 FROM lgu_submissions ls 
              WHERE ls.situational_report_id = r.situational_report_id 
                AND REGEXP_REPLACE(ls.city, '\\s*\\(.*\\)\\s*$', '') = REGEXP_REPLACE(rr.city, '\\s*\\(.*\\)\\s*$', '')
                AND ls.status = 'Approved'
            ))`;
          }
        }
        const { rows: reportRows } = await pool.query(rrQuery, rrParams);
        rawData['affected_population'] = reportRows;
      } else {
        rawData[table] = rows;
      }
    }));

    res.json({ details: rawData });
  } catch (err) {
    console.error('[Reports/Consolidated] ERROR:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/:table
router.get('/:table', authenticate, async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Unknown table' });

  const { event_id, situational_report_id } = req.query;
  const user = req.user;
  const isRegional = ['Regional Admin', 'Regional', 'Super Admin', 'Regional Approver'].includes(user.account_type) || user.role === 'Super Admin';

  let baseQuery = `SELECT t.*, sr.province FROM ${table} t `;
  if (table === 'report_rows') baseQuery += `INNER JOIN reports r ON t.report_id = r.id INNER JOIN situational_reports sr ON r.situational_report_id = sr.id`;
  else if (table === 'roads_and_bridges_sections') baseQuery += `INNER JOIN roads_and_bridges rb ON t.report_id = rb.id INNER JOIN situational_reports sr ON rb.situational_report_id = sr.id`;
  else baseQuery += `INNER JOIN situational_reports sr ON t.situational_report_id = sr.id`;

  const conditions = [];
  const params = [];

  if (!isRegional) {
    const isLgu = ['LGU', 'LGU Admin', 'LGU Approver'].includes(user.account_type);
    const isProvincial = ['Provincial', 'Provincial Admin', 'Provincial Approver'].includes(user.account_type);

    if (isLgu && user.city) {
      if (!['reports', 'roads_and_bridges_sections'].includes(table)) {
        params.push(user.city.replace(/\s*\(.*\)\s*$/, '').trim());
        conditions.push(cityCondition('t', params.length));
      }
    } else if (user.province) {
      params.push(user.province);
      conditions.push(`(sr.province = $${params.length} OR sr.province IS NULL)`);
    }

    if (!isLgu && !isProvincial && !['reports', 'report_rows', 'roads_and_bridges_sections'].includes(table)) {
       conditions.push(`(t.city IS NULL OR t.city = '' OR EXISTS (
        SELECT 1 FROM lgu_submissions ls 
        WHERE ls.situational_report_id = t.situational_report_id 
          AND REGEXP_REPLACE(ls.city, '\\s*\\(.*\\)\\s*$', '') = REGEXP_REPLACE(t.city, '\\s*\\(.*\\)\\s*$', '')
          AND ls.status = 'Approved'
      ))`);
    }
  }

  if (event_id) { params.push(event_id); conditions.push(table === 'report_rows' ? `r.event_id = $${params.length}` : `t.event_id = $${params.length}`); }
  if (situational_report_id) { 
    const ids = situational_report_id.split(',').filter(id => id.trim());
    if (ids.length > 0) { params.push(ids); conditions.push(table === 'report_rows' ? `r.situational_report_id = ANY($${params.length}::uuid[])` : `t.situational_report_id = ANY($${params.length}::uuid[])`); }
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  try {
    const { rows } = await pool.query(`${baseQuery} ${where} ORDER BY t.created_at DESC`, params);
    res.json(rows);
  } catch (err) {
    console.error(`[Reports/GET/${table}]`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/reports/:table
router.post('/:table', authenticate, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Unknown table' });
  const body = req.body;
  const columns = Object.keys(body);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const values = columns.map(col => typeof body[col] === 'object' && body[col] !== null ? JSON.stringify(body[col]) : body[col]);

  try {
    const { rows } = await pool.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`, values);
    if (req.app.locals.io) req.app.locals.io.emit(`${table}:created`, rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(`[Reports/POST/${table}]`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/reports/:table/bulk
router.post('/:table/bulk', authenticate, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Unknown table' });
  const data = req.body;
  if (!Array.isArray(data) || data.length === 0) return res.status(400).json({ error: 'Array required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const row of data) {
      const cols = Object.keys(row);
      const vals = cols.map(c => typeof row[c] === 'object' && row[c] !== null ? JSON.stringify(row[c]) : row[c]);
      const { rows } = await client.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i+1}`).join(',')}) RETURNING *`, vals);
      results.push(rows[0]);
    }
    await client.query('COMMIT');
    if (req.app.locals.io) req.app.locals.io.emit(`${table}:bulk_created`, { count: results.length });
    res.status(201).json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

// PATCH /api/reports/:table/bulk
router.patch('/:table/bulk', authenticate, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Unknown table' });
  const data = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const row of data) {
      const { id, ...body } = row;
      const cols = Object.keys(body);
      const vals = cols.map(c => typeof body[c] === 'object' && body[c] !== null ? JSON.stringify(body[c]) : body[c]);
      vals.push(id);
      const { rows } = await client.query(`UPDATE ${table} SET ${cols.map((c, i) => `${c}=$${i+1}`).join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      if (rows.length > 0) results.push(rows[0]);
    }
    await client.query('COMMIT');
    res.json(results);
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: 'Server error' }); }
  finally { client.release(); }
});

router.delete('/:table/:id', authenticate, async (req, res) => {
  const { table, id } = req.params;
  try { await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:table/bulk', authenticate, async (req, res) => {
  const { table } = req.params;
  const { ids } = req.body;
  try { const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE id = ANY($1::uuid[])`, [ids]); res.json({ success: true, deleted: rowCount }); }
  catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;

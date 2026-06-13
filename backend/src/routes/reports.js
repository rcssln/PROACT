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
  
  if (!situational_report_id) return res.status(400).json({ error: 'situational_report_id is required' });

  const isSuperAdmin = user.account_type === 'Super Admin' || user.role === 'Super Admin';
  const isRegional = ['Regional Admin', 'Regional', 'Regional Approver'].includes(user.account_type);
  const isLgu = ['LGU', 'LGU Admin', 'LGU Approver'].includes(user.account_type);
  const isProvincial = ['Provincial', 'Provincial Admin', 'Provincial Approver'].includes(user.account_type);

  console.log(`[Reports/all-types] User: ${user.email} (Type: ${user.account_type}), SR: ${situational_report_id}, isSuperAdmin: ${isSuperAdmin}`);

  // Check if report is approved if user is a basic Regional viewer
  if (user.account_type === 'Regional' && !isSuperAdmin) {
    try {
      const { rows: srRows } = await pool.query('SELECT status FROM situational_reports WHERE id = $1', [situational_report_id]);
      if (srRows.length > 0 && srRows[0].status !== 'Approved') {
        console.warn(`[Reports/all-types] Forbidden: Regional viewer ${user.email} accessing unapproved SR ${situational_report_id}`);
        return res.status(403).json({ 
          error: 'This report has not been approved by the Province yet.',
          debug_reason: 'REGIONAL_VIEWER_UNAPPROVED_REPORT',
          user: { email: user.email, account_type: user.account_type, isSuperAdmin }
        });
      }
    } catch (err) {
      console.error('[Reports/all-types] Status check failed:', err);
    }
  }

  const results = [];
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

    await Promise.all(tables.map(async (table) => {
      let query = `SELECT t.* FROM ${table.name} t`;
      const conditions = [`t.situational_report_id = $1`];
      const params = [situational_report_id];

      if (!isSuperAdmin) {
        if (isLgu && user.city) {
          const cleanCity = user.city.replace(/\s*\(.*\)\s*$/, '').trim();
          params.push(cleanCity);
          conditions.push(cityCondition('t', params.length));
        } else if (user.province && !isRegional) {
          query += ` INNER JOIN situational_reports sr ON t.situational_report_id = sr.id`;
          params.push(user.province);
          // Allow seeing own province OR Regional reports
          conditions.push(`(sr.province = $${params.length} OR sr.province IS NULL OR sr.province = 'Region 1')`);
        }
      }

      // Keep visibility check: non-LGUs and non-Admins only see Approved data
      if (!isLgu && !isSuperAdmin) {
        conditions.push(`(t.city IS NULL OR t.city = '' OR EXISTS (
          SELECT 1 FROM lgu_submissions ls 
          WHERE ls.situational_report_id = t.situational_report_id 
            AND ls.city = t.city 
            AND ls.status = 'Approved'
        ))`);
      }

      const { rows } = await pool.query(`${query} WHERE ${conditions.join(' AND ')}`, params);
      
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
    const { rows: reports } = await pool.query('SELECT id, created_at FROM reports WHERE situational_report_id = $1', [situational_report_id]);

    if (reports.length > 0) {
      const reportIds = reports.map(r => r.id);
      let rowsQuery = `SELECT t.*, r.situational_report_id, r.created_at as parent_created_at FROM report_rows t INNER JOIN reports r ON t.report_id = r.id`;
      const rowsConditions = [`t.report_id = ANY($1::uuid[])`];
      const rowsParams = [reportIds];

      if (isLgu && user.city) {
        const cleanCity = user.city.replace(/\s*\(.*\)\s*$/, '').trim();
        rowsParams.push(cleanCity);
        rowsConditions.push(cityCondition('t', rowsParams.length));
      } else if (!isLgu && !isSuperAdmin) {
        // Keep visibility check from remote: non-LGUs and non-Admins only see Approved data
        rowsConditions.push(`(t.city IS NULL OR t.city = '' OR EXISTS (
          SELECT 1 FROM lgu_submissions ls 
          WHERE ls.situational_report_id = r.situational_report_id 
            AND ls.city = t.city 
            AND ls.status = 'Approved'
        ))`);
      }

      const { rows: reportRows } = await pool.query(`${rowsQuery} WHERE ${rowsConditions.join(' AND ')}`, rowsParams);
      
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

    res.json(results);
  } catch (err) {
    console.error('[Reports/all-types] ERROR:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
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
    const isSuperAdmin = user.account_type === 'Super Admin' || user.role === 'Super Admin';
    const isRegional = ['Regional Admin', 'Regional', 'Regional Approver'].includes(user.account_type);
    const isLgu = ['LGU', 'LGU Admin', 'LGU Approver'].includes(user.account_type);
    const isProvincial = ['Provincial', 'Provincial Admin', 'Provincial Approver'].includes(user.account_type);

    await Promise.all(tables.map(async (table) => {
      let baseQuery = `SELECT t.*, sr.province FROM ${table} t INNER JOIN situational_reports sr ON t.situational_report_id = sr.id`;
      const conditions = [`t.event_id = $1`];
      const params = [event_id];

      if (!isSuperAdmin) {
        if (isLgu && user.city) {
          if (table !== 'reports') {
            params.push(user.city.replace(/\s*\(.*\)\s*$/, '').trim());
            conditions.push(cityCondition('t', params.length));
          }
        } else if (user.province && !isRegional) {
          params.push(user.province);
          conditions.push(`(sr.province = $${params.length} OR sr.province IS NULL)`);
        }

        if (!isLgu && !isProvincial && table !== 'reports' && !isRegional && !isSuperAdmin) {
          conditions.push(`(t.city IS NULL OR t.city = '' OR EXISTS (
            SELECT 1 FROM lgu_submissions ls 
            WHERE ls.situational_report_id = t.situational_report_id 
              AND REGEXP_REPLACE(ls.city, '\\s*\\(.*\\)\\s*$', '') = REGEXP_REPLACE(t.city, '\\s*\\(.*\\)\\s*$', '')
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
        
        if (!isSuperAdmin) {
          if (isLgu && user.city) {
            rrParams.push(user.city.replace(/\s*\(.*\)\s*$/, '').trim());
            rrQuery += ` AND ${cityCondition('rr', rrParams.length)}`;
          } else if (!isLgu && !isProvincial && !isRegional && !isSuperAdmin) {
            rrQuery += ` AND (rr.city IS NULL OR rr.city = '' OR EXISTS (
              SELECT 1 FROM lgu_submissions ls 
              WHERE ls.situational_report_id = r.situational_report_id 
                AND REGEXP_REPLACE(ls.city, '\\s*\\(.*\\)\\s*$/, '') = REGEXP_REPLACE(rr.city, '\\s*\\(.*\\)\\s*$', '')
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

    // Logic to calculate categoryTotals and byCityCategory (matching lib/generateConsolidatedCsv.js logic)
    const mappedDetails = {};
    const categoryTotals = {};
    const byCityCategory = {};

    Object.entries(rawData).forEach(([table, rows]) => {
      let catKey = table;
      if (table === 'affected_population') catKey = 'affectedPopulation';
      else if (table === 'related_incidents') catKey = 'relatedIncidents';
      else if (table === 'roads_and_bridges') catKey = 'roadsAndBridges';
      else if (table === 'power_reports') catKey = 'power';
      else if (table === 'water_supply_reports') catKey = 'waterSupply';
      else if (table === 'communication_lines_reports') catKey = 'communicationLines';
      else if (table === 'damaged_houses_reports') catKey = 'damagedHouses';
      else if (table === 'class_suspension_reports') catKey = 'classSuspension';
      else if (table === 'work_suspension_reports') catKey = 'workSuspension';
      else if (table === 'declaration_state_of_calamity_reports') catKey = 'stateOfCalamity';
      else if (table === 'pre_emptive_evacuation_reports') catKey = 'preEmptiveEvacuation';
      else if (table === 'assistance_provided_reports') catKey = 'assistanceProvided';
      else if (table === 'assistance_lgus_agencies_reports') catKey = 'assistanceLgusAgencies';
      else if (table === 'agriculture_damage_reports') catKey = 'agricultureDamage';
      else if (table === 'infrastructure_damage_reports') catKey = 'infrastructureDamage';

      mappedDetails[catKey] = rows;
      categoryTotals[catKey] = rows.length;

      rows.forEach(row => {
        const city = row.city || 'Other';
        if (!byCityCategory[city]) byCityCategory[city] = {};
        byCityCategory[city][catKey] = (byCityCategory[city][catKey] || 0) + 1;
      });
    });

    res.json({ 
      details: mappedDetails, 
      categoryTotals, 
      byCityCategory,
      summaryData: { categoryTotals, byCityCategory, details: mappedDetails }
    });
  } catch (err) {
    console.error('[Reports/Consolidated] ERROR:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /api/reports/:table
router.get('/:table', authenticate, async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: 'Unknown table' });

  const { event_id, situational_report_id } = req.query;
  const user = req.user;
  const isSuperAdmin = user.account_type === 'Super Admin' || user.role === 'Super Admin';
  const isRegional = ['Regional Admin', 'Regional', 'Regional Approver'].includes(user.account_type);

  let baseQuery = `SELECT t.*, sr.province FROM ${table} t `;
  if (table === 'report_rows') baseQuery += `INNER JOIN reports r ON t.report_id = r.id INNER JOIN situational_reports sr ON r.situational_report_id = sr.id`;
  else if (table === 'roads_and_bridges_sections') baseQuery += `INNER JOIN roads_and_bridges rb ON t.report_id = rb.id INNER JOIN situational_reports sr ON rb.situational_report_id = sr.id`;
  else baseQuery += `INNER JOIN situational_reports sr ON t.situational_report_id = sr.id`;

  const conditions = [];
  const params = [];

  // Check if report is approved if user is a basic Regional viewer
  if (user.account_type === 'Regional' && !isSuperAdmin) {
    conditions.push("sr.status = 'Approved'");
  }

  if (!isSuperAdmin) {
    const isLgu = ['LGU', 'LGU Admin', 'LGU Approver'].includes(user.account_type);
    const isProvincial = ['Provincial', 'Provincial Admin', 'Provincial Approver'].includes(user.account_type);

    if (isLgu && user.city) {
      if (!['reports', 'roads_and_bridges_sections'].includes(table)) {
        params.push(user.city.replace(/\s*\(.*\)\s*$/, '').trim());
        conditions.push(cityCondition('t', params.length));
      }
    } else if (user.province && !isRegional) {
      params.push(user.province);
      conditions.push(`(sr.province = $${params.length} OR sr.province IS NULL)`);
    }

    if (!isLgu && !isProvincial && !isRegional && !isSuperAdmin && !['reports', 'report_rows', 'roads_and_bridges_sections'].includes(table)) {
       conditions.push(`(t.city IS NULL OR t.city = '' OR EXISTS (
        SELECT 1 FROM lgu_submissions ls 
        WHERE ls.situational_report_id = t.situational_report_id 
          AND REGEXP_REPLACE(ls.city, '\\s*\\(.*\\)\\s*$/, '') = REGEXP_REPLACE(t.city, '\\s*\\(.*\\)\\s*$', '')
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
    console.error(`[Reports/GET/${table}] ERROR:`, err.message);
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
    const io = req.app.locals.io;
    if (io) {
      io.emit(`${table}:created`, rows[0]);
      io.emit('reports:changed', { situational_report_id: rows[0].situational_report_id, table });
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(`[Reports/POST/${table}] ERROR:`, err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
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
    const io = req.app.locals.io;
    if (io) {
      io.emit(`${table}:bulk_created`, { count: results.length });
      if (results.length > 0) {
        io.emit('reports:changed', { situational_report_id: results[0].situational_report_id, table });
      }
    }
    res.status(201).json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Reports/POST/${table}/bulk] ERROR:`, err.message);
    res.status(500).json({ error: 'Server error', details: err.message, table: err.table, constraint: err.constraint });
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
    const io = req.app.locals.io;
    if (io && results.length > 0) {
      io.emit('reports:changed', { situational_report_id: results[0].situational_report_id, table });
    }
    res.json(results);
  } catch (err) { 
    await client.query('ROLLBACK'); 
    console.error(`[Reports/PATCH/${table}/bulk] ERROR:`, err.message);
    res.status(500).json({ error: 'Server error', details: err.message, table: err.table, constraint: err.constraint }); 
  } finally { client.release(); }
});

router.delete('/:table/bulk', authenticate, async (req, res) => {
  const { table } = req.params;
  const { ids } = req.body;
  
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Unknown table', table });
  }
  
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids array required', received: typeof ids });
  }
  
  const validIds = ids.filter(id => id && typeof id === 'string' && id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
  if (validIds.length === 0) {
    return res.status(400).json({ error: 'Invalid ID format', received: ids });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (table === 'reports') {
      await client.query('DELETE FROM report_rows WHERE report_id = ANY($1::uuid[])', [validIds]);
    } else if (table === 'roads_and_bridges') {
      await client.query('DELETE FROM roads_and_bridges_sections WHERE report_id = ANY($1::uuid[])', [validIds]);
    }
    const { rowCount } = await client.query(`DELETE FROM ${table} WHERE id = ANY($1::uuid[])`, [validIds]);
    await client.query('COMMIT');
    res.json({ success: true, deleted: rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Reports/DELETE/${table}/bulk] ERROR:`, err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally { client.release(); }
});

router.delete('/:table/:id', authenticate, async (req, res) => {
  const { table, id } = req.params;
  console.log(`[Reports/DELETE] Table: ${table}, ID: ${id}`);
  
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Unknown table', table });
  }
  
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    console.warn(`[Reports/DELETE] Invalid ID format: ${id}`);
    return res.status(400).json({ error: 'Invalid ID format', received: id });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch situational_report_id before deleting for socket notification
    let sitRepId = null;
    const findRes = await client.query(`SELECT situational_report_id FROM ${table} WHERE id = $1`, [id]);
    if (findRes.rows.length > 0) sitRepId = findRes.rows[0].situational_report_id;

    if (table === 'reports') {
      await client.query('DELETE FROM report_rows WHERE report_id = $1', [id]);
    } else if (table === 'roads_and_bridges') {
      await client.query('DELETE FROM roads_and_bridges_sections WHERE report_id = $1', [id]);
    }
    const { rowCount } = await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    await client.query('COMMIT');
    
    const io = req.app.locals.io;
    if (io && sitRepId) {
      io.emit('reports:changed', { situational_report_id: sitRepId, table, action: 'deleted' });
    }

    console.log(`[Reports/DELETE] Successfully deleted row from ${table}. rowCount: ${rowCount}`);
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Reports/DELETE/${table}] ERROR:`, err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally { client.release(); }
});

module.exports = router;
;

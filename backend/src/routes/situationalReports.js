const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// --- HELPER FUNCTIONS FOR AUTO-CLONE ---

function getCloneScope(user) {
  const isRegional = ['Regional Admin', 'Regional', 'Super Admin', 'Regional Approver'].includes(user.account_type) || user.role === 'Super Admin';
  const isProvincial = ['Provincial Admin', 'Provincial', 'Provincial Approver'].includes(user.account_type);
  const isLGU = ['LGU', 'LGU Admin'].includes(user.account_type);

  return {
    isRegional,
    isProvincial,
    isLGU,
    userProvince: user.province || null,
    userCity: user.city || null,
    scopeType: isRegional ? 'REGIONAL' : isProvincial ? 'PROVINCIAL' : 'LGU',
  };
}

function buildScopeFilter(scope) {
  if (scope.isRegional) return null;
  if (scope.isProvincial) return { condition: `province = $3`, values: [scope.userProvince] };
  if (scope.isLGU) return { condition: `city = $3`, values: [scope.userCity] };
  return null;
}

async function cloneTable(client, tableName, sourceSitRepId, newSitRepId, eventId, scopeFilter) {
  const columnsQuery = `
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = $1 AND column_name NOT IN ('id', 'created_at', 'updated_at')
  `;
  const columnsResult = await client.query(columnsQuery, [tableName]);
  const columns = columnsResult.rows.map(row => row.column_name);

  if (columns.length === 0) return 0;

  let whereClause = `situational_report_id = $1 AND event_id = $2`;
  let params = [sourceSitRepId, eventId];
  
  if (scopeFilter && columns.includes(scopeFilter.condition.split(' ')[0])) {
    whereClause += ` AND ${scopeFilter.condition}`;
    params.push(...scopeFilter.values);
  }

  const selectQuery = `SELECT ${columns.join(', ')} FROM ${tableName} WHERE ${whereClause}`;
  const sourceData = await client.query(selectQuery, params);

  if (sourceData.rows.length === 0) return 0;

  for (const row of sourceData.rows) {
    const insertColumns = ['situational_report_id', 'event_id', ...columns.filter(c => c !== 'situational_report_id' && c !== 'event_id')];
    const insertValues = [newSitRepId, eventId, ...columns.filter(c => c !== 'situational_report_id' && c !== 'event_id').map(col => row[col])];
    const placeholders = insertColumns.map((_, i) => `$${i + 1}`).join(', ');

    const insertQuery = `INSERT INTO ${tableName} (${insertColumns.join(', ')}) VALUES (${placeholders})`;
    await client.query(insertQuery, insertValues);
  }

  return sourceData.rows.length;
}

async function cloneAllDataTablesWithClient(sourceSitRepId, newSitRepId, eventId, user, client) {
  const scope = getCloneScope(user);
  const scopeFilter = buildScopeFilter(scope);
  let totalCloned = 0;

  const simpleTables = [
    'related_incidents', 'agriculture_damage_reports', 'assistance_lgus_agencies_reports',
    'assistance_provided_reports', 'class_suspension_reports', 'communication_lines_reports',
    'damaged_houses_reports', 'declaration_state_of_calamity_reports', 'infrastructure_damage_reports',
    'power_reports', 'pre_emptive_evacuation_reports', 'water_supply_reports', 'work_suspension_reports'
  ];

  for (const table of simpleTables) {
    totalCloned += await cloneTable(client, table, sourceSitRepId, newSitRepId, eventId, scopeFilter);
  }

  // Clone 'reports' (Affected Population) and their child 'report_rows'
  let reportWhere = `situational_report_id = $1 AND event_id = $2`;
  let reportParams = [sourceSitRepId, eventId];
  if (scopeFilter) {
    reportWhere += ` AND ${scopeFilter.condition}`;
    reportParams.push(...scopeFilter.values);
  }

  const { rows: sourceReports } = await client.query(`SELECT * FROM reports WHERE ${reportWhere}`, reportParams);
  
  if (sourceReports.length > 0) {
    totalCloned += sourceReports.length;
    for (const report of sourceReports) {
      const rCols = Object.keys(report).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
      const rVals = rCols.map(k => k === 'situational_report_id' ? newSitRepId : report[k]);
      const rPlaceholders = rVals.map((_, i) => `$${i + 1}`).join(', ');
      
      const { rows: newReportRows } = await client.query(
        `INSERT INTO reports (${rCols.join(', ')}) VALUES (${rPlaceholders}) RETURNING id`,
        rVals
      );
      const newReportId = newReportRows[0].id;

      const { rows: sourceReportRows } = await client.query(
        `SELECT * FROM report_rows WHERE report_id = $1::uuid`,
        [report.id]
      );
      
      if (sourceReportRows.length > 0) {
        for (const rrow of sourceReportRows) {
          const rrCols = Object.keys(rrow).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
          const rrVals = rrCols.map(k => k === 'report_id' ? newReportId : rrow[k]);
          const rrPlaceholders = rrVals.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(
            `INSERT INTO report_rows (${rrCols.join(', ')}) VALUES (${rrPlaceholders})`,
            rrVals
          );
        }
      }
    }
  }

  // Clone 'roads_and_bridges' and their child 'roads_and_bridges_sections'
  const { rows: sourceRoads } = await client.query(`SELECT * FROM roads_and_bridges WHERE ${reportWhere}`, reportParams);
  
  if (sourceRoads.length > 0) {
    totalCloned += sourceRoads.length;
    for (const road of sourceRoads) {
      const rCols = Object.keys(road).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
      const rVals = rCols.map(k => k === 'situational_report_id' ? newSitRepId : road[k]);
      const rPlaceholders = rVals.map((_, i) => `$${i + 1}`).join(', ');
      
      const { rows: newRoadRows } = await client.query(
        `INSERT INTO roads_and_bridges (${rCols.join(', ')}) VALUES (${rPlaceholders}) RETURNING id`,
        rVals
      );
      const newRoadId = newRoadRows[0].id;

      const { rows: sourceSections } = await client.query(
        `SELECT * FROM roads_and_bridges_sections WHERE report_id = $1::uuid`,
        [road.id]
      );
      
      if (sourceSections.length > 0) {
        for (const sec of sourceSections) {
          const sCols = Object.keys(sec).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
          const sVals = sCols.map(k => k === 'report_id' ? newRoadId : sec[k]);
          const sPlaceholders = sVals.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(
            `INSERT INTO roads_and_bridges_sections (${sCols.join(', ')}) VALUES (${sPlaceholders})`,
            sVals
          );
        }
      }
    }
  }

  return totalCloned;
}


// --- API ROUTES ---

// GET /api/situational-reports
router.get('/', authenticate, async (req, res) => {
  const { event_id, status, count_only } = req.query;
  try {
    let query = `
      SELECT sr.*, 
             concat(u.first_name, ' ', u.last_name) as creator_name,
             u.city as creator_city,
             json_build_object('id', e.id, 'name', e.name) as events
      FROM situational_reports sr
      LEFT JOIN events e ON sr.event_id = e.id
      LEFT JOIN users u ON sr.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (event_id && event_id !== 'all') {
      params.push(event_id);
      query += ` AND sr.event_id = $${params.length}`;
    }

    // Regional/Super Admin: Only see data from APPROVED situational reports
    const isRegional = ['Regional Admin', 'Regional', 'Super Admin'].includes(req.user.account_type) || req.user.role === 'Super Admin';
    if (isRegional) {
      query += " AND sr.status = 'Approved'";
    }

    if (status) {
      params.push(status);
      query += ` AND sr.status = $${params.length}`;
    }

    // Provincial/LGU-level scoping
    if (!isRegional && req.user.province) {
      params.push(req.user.province);
      // Allow them to see their own province, OR Regional reports (NULL or 'Region 1')
      query += ` AND (sr.province = $${params.length} OR sr.province IS NULL OR sr.province = 'Region 1')`;
    }

    if (count_only === 'true') {
      const countQuery = `SELECT COUNT(*) FROM (${query}) AS sub`;
      const { rows } = await pool.query(countQuery, params);
      return res.json({ count: parseInt(rows[0].count) });
    }

    query += ' ORDER BY sr.created_at DESC, sr.report_number DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[SitReps/GET]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/situational-reports/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM situational_reports WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Report not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[SitReps/GET/:id]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/situational-reports
router.post('/', authenticate, async (req, res) => {
  const { event_id, title, target_lgus, pinged_report_types, province, copy_from_id } = req.body;
  const user = req.user;
  
  try {
    const eventRes = await pool.query('SELECT * FROM events WHERE id = $1', [event_id]);
    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get next report number
      const countRes = await client.query(
        'SELECT COALESCE(MAX(report_number), 0) AS max_num FROM situational_reports WHERE event_id = $1',
        [event_id]
      );
      const nextNumber = parseInt(countRes.rows[0].max_num) + 1;
      const finalTitle = title || `Situational Report No. ${nextNumber}`;

      const { rows } = await client.query(
        `INSERT INTO situational_reports (event_id, report_number, title, target_lgus, province, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [event_id, nextNumber, finalTitle, target_lgus || [], province || user.province || null, user.id]
      );

      const sitRep = rows[0];

      // Update pinged_report_types on the event
      if (pinged_report_types && pinged_report_types.length > 0) {
        await client.query(
          'UPDATE events SET pinged_report_types = $1 WHERE id = $2',
          [JSON.stringify(pinged_report_types), event_id]
        );
      }

      // Auto-Clone Logic
      let sourceToClone = copy_from_id;
      let totalCloned = 0;

      if (!sourceToClone && req.body.skip_auto_clone !== true) {
        // Auto-detect latest SitRep
        const latestRes = await client.query(
          `SELECT id FROM situational_reports 
           WHERE event_id = $1 AND status NOT IN ('Draft') AND id != $2
           ORDER BY created_at DESC LIMIT 1`,
          [event_id, sitRep.id]
        );
        sourceToClone = latestRes.rows[0]?.id || null;
      }

      if (sourceToClone) {
        console.log(`[SitReps/POST] Auto-cloning from ${sourceToClone} to ${sitRep.id}`);
        totalCloned = await cloneAllDataTablesWithClient(sourceToClone, sitRep.id, event_id, req.user, client);
        
        // Update the new sitrep to mark it as cloned
        await client.query(
          `UPDATE situational_reports 
           SET cloned_from_id = $1, auto_cloned = TRUE, cloned_at = NOW() 
           WHERE id = $2`,
          [sourceToClone, sitRep.id]
        );
      }

      // Notify targeted LGU users (after cloning so we don't break transaction if it fails)
      if (target_lgus && target_lgus.length > 0) {
        const normalizedCities = target_lgus.map(c => c.includes(' (') ? c.split(' (')[0] : c);
        const lguUsersRes = await client.query(
          `SELECT id, city, province FROM users WHERE account_type = 'LGU' AND city = ANY($1::text[]) AND province = $2`,
          [normalizedCities, user.province]
        );

        if (lguUsersRes.rows.length > 0) {
          const notifValues = lguUsersRes.rows.map(u => [
            u.id, 'sitrep_assignment', 'New Situational Report',
            `A new situational report "${finalTitle}" has been created for your LGU.`,
            JSON.stringify({ sitrep_id: sitRep.id, event_id, created_at: new Date().toISOString() })
          ]);

          for (const n of notifValues) {
            await client.query(
              'INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1,$2,$3,$4,$5)',
              n
            );
          }

          for (const u of lguUsersRes.rows) {
            await client.query(
              `INSERT INTO event_deployments (event_id, city, province, deployed_by, strength_label, strength_value)
               VALUES ($1,$2,$3,$4,'Standard',1) ON CONFLICT (event_id, city) DO NOTHING`,
              [event_id, u.city, u.province || user.province, user.id]
            );
          }
        }
      }

      await client.query('COMMIT');
      
      const io = req.app.locals.io;
      io.emit('sitrep:created', sitRep);

      res.status(201).json({ 
        ...sitRep, 
        autoCloned: !!sourceToClone,
        cloned_from_id: sourceToClone,
        debug_cloned_count: totalCloned 
      });

    } catch (txErr) {
      await client.query('ROLLBACK');
      console.error('[SitReps/POST] Transaction failed:', txErr);
      res.status(500).json({ error: 'Server error during SitRep creation' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[SitReps/POST]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/situational-reports/:id
router.patch('/:id', authenticate, async (req, res) => {
  const { title, target_lgus, status, rejection_remarks, approved_pdf_url, pending_pdf_url, summary } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE situational_reports SET
        title = COALESCE($1, title),
        target_lgus = COALESCE($2, target_lgus),
        status = COALESCE($3, status),
        rejection_remarks = COALESCE($4, rejection_remarks),
        approved_pdf_url = COALESCE($5, approved_pdf_url),
        pending_pdf_url = COALESCE($6, pending_pdf_url),
        summary = COALESCE($7, summary)
       WHERE id = $8 RETURNING *`,
      [title, target_lgus, status, rejection_remarks, approved_pdf_url, pending_pdf_url, summary, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Report not found' });

    const io = req.app.locals.io;
    io.emit('sitrep:updated', rows[0]);

    res.json(rows[0]);
  } catch (err) {
    console.error('[SitReps/PATCH]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/situational-reports/:id/report-data  – all 15 sub-tables for one SitRep
router.get('/:id/report-data', authenticate, async (req, res) => {
  const sitRepId = req.params.id;
  const event_id = req.query.event_id;
  try {
    const tables = [
      'related_incidents', 'agriculture_damage_reports', 'assistance_lgus_agencies_reports',
      'assistance_provided_reports', 'class_suspension_reports', 'communication_lines_reports',
      'damaged_houses_reports', 'declaration_state_of_calamity_reports',
      'infrastructure_damage_reports', 'power_reports', 'pre_emptive_evacuation_reports',
      'roads_and_bridges', 'water_supply_reports', 'work_suspension_reports',
      'reports', 'roads_and_bridges_sections'
    ];

    const results = {};
    await Promise.all(tables.map(async (table) => {
      let q = `SELECT * FROM ${table} WHERE situational_report_id = $1`;
      const params = [sitRepId];
      if (event_id) { q += ' AND event_id = $2'; params.push(event_id); }
      const { rows } = await pool.query(q, params);
      results[table] = rows;
    }));

    if (results.reports && results.reports.length > 0) {
      const reportIds = results.reports.map(r => r.id);
      const { rows: reportRows } = await pool.query(
        'SELECT * FROM report_rows WHERE report_id = ANY($1::uuid[])',
        [reportIds]
      );
      results.report_rows = reportRows;
    } else {
      results.report_rows = [];
    }

    res.json(results);
  } catch (err) {
    console.error('[SitReps/report-data]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/situational-reports/:id
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const tables = [
      'related_incidents', 'agriculture_damage_reports', 'assistance_lgus_agencies_reports',
      'assistance_provided_reports', 'class_suspension_reports', 'communication_lines_reports',
      'damaged_houses_reports', 'declaration_state_of_calamity_reports',
      'infrastructure_damage_reports', 'power_reports', 'pre_emptive_evacuation_reports',
      'roads_and_bridges', 'water_supply_reports', 'work_suspension_reports',
      'reports'
    ];
    
    // Delete child rows from report tables to handle cascade manually if needed
    for (const table of tables) {
      await client.query(`DELETE FROM ${table} WHERE situational_report_id = $1`, [id]);
    }
    
    // Deleting from situational_reports will naturally delete child records if CASCADE is set,
    // but the manual deletion above ensures no orphans in non-cascading setups
    await client.query('DELETE FROM situational_reports WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    const io = req.app.locals.io;
    io.emit('sitrep:deleted', { id });
    
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SitReps/DELETE]', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

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

// GET /api/reports/all-types?situational_report_id=
// Fetches every row from every sub-table for a specific SitRep
router.get('/all-types', authenticate, async (req, res) => {
  const { situational_report_id } = req.query;
  if (!situational_report_id) return res.status(400).json({ error: 'situational_report_id is required' });

  try {
    const tables = [
      { name: 'related_incidents', label: 'Related Incidents', id: 'incidents' },
      { name: 'agriculture_damage_reports', label: 'Agriculture Damage', id: 'agriculture' },
      { name: 'assistance_lgus_agencies_reports', label: 'Assistance (LGUs/Agencies)', id: 'assistance_lgus' },
      { name: 'assistance_provided_reports', label: 'Assistance Provided', id: 'assistance' },
      { name: 'class_suspension_reports', label: 'Class Suspension', id: 'class' },
      { name: 'communication_lines_reports', label: 'Communication Lines', id: 'communication' },
      { name: 'damaged_houses_reports', label: 'Damaged Houses', id: 'houses' },
      { name: 'declaration_state_of_calamity_reports', label: 'State of Calamity', id: 'calamity' },
      { name: 'infrastructure_damage_reports', label: 'Infrastructure Damage', id: 'infrastructure' },
      { name: 'power_reports', label: 'Power Status', id: 'power' },
      { name: 'pre_emptive_evacuation_reports', label: 'Pre-emptive Evac', id: 'preemptive' },
      { name: 'roads_and_bridges', label: 'Roads & Bridges', id: 'roads' },
      { name: 'water_supply_reports', label: 'Water Status', id: 'water' },
      { name: 'work_suspension_reports', label: 'Work Suspension', id: 'work' }
    ];

    const results = [];
    
    // 1. Handle regular sub-tables
    await Promise.all(tables.map(async (table) => {
      const { rows } = await pool.query(
        `SELECT * FROM ${table.name} WHERE situational_report_id = $1`,
        [situational_report_id]
      );
      rows.forEach(r => {
        let subject = r.barangay || r.city || r.road_bridge_name || r.telecompany || r.infrastructure_name || 'Report Entry';
        let summary = r.type || r.classification || r.status || '';
        
        if (table.id === 'power' || table.id === 'water') {
          summary = `${r.status || 'Ongoing'} | ${r.service_provider || ''}`;
        } else if (table.id === 'roads') {
          summary = `${r.status || 'Passable'} | ${r.classification || ''}`;
        } else if (table.id === 'houses') {
          summary = `Totally: ${r.totally_damaged || 0} | Partially: ${r.partially_damaged || 0}`;
        }

        results.push({
          ...r,
          category: table.id,
          tableName: table.name,
          categoryTitle: table.label,
          subject: subject,
          summary: summary,
          timestamp: r.created_at
        });
      });
    }));

    // 2. Handle Affected Population (reports -> report_rows)
    const { rows: reports } = await pool.query(
      'SELECT id, created_at FROM reports WHERE situational_report_id = $1',
      [situational_report_id]
    );

    if (reports.length > 0) {
      const reportIds = reports.map(r => r.id);
      const { rows: reportRows } = await pool.query(
        'SELECT * FROM report_rows WHERE report_id = ANY($1::uuid[])',
        [reportIds]
      );
      reportRows.forEach(r => {
        results.push({
          ...r,
          category: 'evacuation',
          tableName: 'reports',
          categoryTitle: 'Affected Population',
          subject: r.barangay,
          timestamp: r.created_at
        });
      });
    }

    res.json(results);
  } catch (err) {
    console.error('[Reports/AllTypes] CRITICAL ERROR:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /api/reports/consolidated
router.get('/consolidated', authenticate, async (req, res) => {
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
    const sitRepIds = situational_report_ids ? situational_report_ids.split(',') : [];

    await Promise.all(tables.map(async (table) => {
      let query = `SELECT * FROM ${table} WHERE event_id = $1`;
      let params = [event_id];

      if (sitRepIds.length > 0) {
        query += ` AND situational_report_id = ANY($2::uuid[])`;
        params.push(sitRepIds);
      }

      const { rows } = await pool.query(query, params);
      
      if (table === 'reports' && rows.length > 0) {
        const reportIds = rows.map(r => r.id);
        const { rows: reportRows } = await pool.query(
          'SELECT * FROM report_rows WHERE report_id = ANY($1::uuid[])',
          [reportIds]
        );
        rawData['affected_population'] = reportRows;
      } else {
        rawData[table] = rows;
      }
    }));

    // --- Aggregation logic for PDF ---
    const citiesSet = new Set();
    const categoryTotals = {
      relatedIncidents: { total: 0, flooded: 0, subsided: 0, receding: 0, fallenDebris: 0, stormSurge: 0, other: 0 },
      affectedPopulation: { families: 0, persons: 0, ecs_now: 0, in_fam_now: 0, in_per_now: 0, out_fam_now: 0, out_per_now: 0, brgy_count: 0 },
      roadsAndBridges: { total: 0, roads: 0, bridges: 0, passable: 0, notPassable: 0 },
      power: { total: 0, interrupted: 0, restored: 0 },
      waterSupply: { total: 0, interrupted: 0, restored: 0 },
      communicationLines: { total: 0, interrupted: 0, restored: 0 },
      damagedHouses: { total: 0, totally: 0, partially: 0, amount: 0 },
      classSuspension: 0,
      workSuspension: 0,
      stateOfCalamity: 0,
      preEmptiveEvacuation: { families: 0, persons: 0 }
    };
    const byCityCategory = {};

    const getCityData = (city) => {
      if (!city) return null;
      citiesSet.add(city);
      if (!byCityCategory[city]) {
        byCityCategory[city] = {
          relatedIncidents: { total: 0, flooded: 0, subsided: 0, receding: 0, fallenDebris: 0, stormSurge: 0, other: 0 },
          affectedPopulation: { families: 0, persons: 0, ecs_now: 0, in_fam_now: 0, in_per_now: 0, out_fam_now: 0, out_per_now: 0, brgy_count: 0 },
          roadsAndBridges: { total: 0, roads: 0, bridges: 0, passable: 0, notPassable: 0 },
          power: { total: 0, interrupted: 0, restored: 0 },
          waterSupply: { total: 0, interrupted: 0, restored: 0 },
          communicationLines: { total: 0, interrupted: 0, restored: 0 },
          damagedHouses: { total: 0, totally: 0, partially: 0, amount: 0 },
          classSuspension: 0,
          workSuspension: 0,
          stateOfCalamity: 0,
          preEmptiveEvacuation: { families: 0, persons: 0 }
        };
      }
      return byCityCategory[city];
    };

    // 1. Related Incidents
    (rawData.related_incidents || []).forEach(r => {
      const city = r.city;
      const cityData = getCityData(city);
      const status = (r.status || '').toLowerCase();
      const type = (r.type_of_incident || r.type || '').toLowerCase();

      const update = (obj) => {
        obj.total++;
        if (type.includes('flood')) {
           if (status.includes('subs')) obj.subsided++;
           else if (status.includes('rece')) obj.receding++;
           else obj.flooded++;
        } else if (type.includes('debris') || type.includes('tree')) obj.fallenDebris++;
        else if (type.includes('surge')) obj.stormSurge++;
        else obj.other++;
      };
      update(categoryTotals.relatedIncidents);
      if (cityData) update(cityData.relatedIncidents);
    });

    // 2. Affected Population
    (rawData.affected_population || []).forEach(r => {
      const city = r.city || 'Unknown';
      const cityData = getCityData(city);
      const update = (obj) => {
        obj.families += (r.affected_families || 0);
        obj.persons += (r.affected_persons || 0);
        obj.ecs_now += (r.ecs_now || 0);
        obj.in_fam_now += (r.inside_families_now || 0);
        obj.in_per_now += (r.inside_persons_now || 0);
        obj.out_fam_now += (r.outside_families_now || 0);
        obj.out_per_now += (r.outside_persons_now || 0);
        obj.brgy_count++;
      };
      update(categoryTotals.affectedPopulation);
      if (cityData) update(cityData.affectedPopulation);
    });

    // 3. Roads and Bridges
    (rawData.roads_and_bridges || []).forEach(r => {
      const city = r.city;
      const cityData = getCityData(city);
      const isRoad = (r.type || '').toLowerCase().includes('road');
      const isPassable = (r.status || '').toLowerCase().includes('passable') && !(r.status || '').toLowerCase().includes('not');

      const update = (obj) => {
        obj.total++;
        if (isRoad) obj.roads++; else obj.bridges++;
        if (isPassable) obj.passable++; else obj.notPassable++;
      };
      update(categoryTotals.roadsAndBridges);
      if (cityData) update(cityData.roadsAndBridges);
    });

    // 4. Power
    (rawData.power_reports || []).forEach(r => {
      const city = r.city;
      const cityData = getCityData(city);
      const isRestored = (r.status || '').toLowerCase().includes('restored');

      const update = (obj) => {
        obj.total++;
        if (isRestored) obj.restored++; else obj.interrupted++;
      };
      update(categoryTotals.power);
      if (cityData) update(cityData.power);
    });

    // 5. Water
    (rawData.water_supply_reports || []).forEach(r => {
      const city = r.city;
      const cityData = getCityData(city);
      const isRestored = (r.status || '').toLowerCase().includes('restored');
      const update = (obj) => {
        obj.total++;
        if (isRestored) obj.restored++; else obj.interrupted++;
      };
      update(categoryTotals.waterSupply);
      if (cityData) update(cityData.waterSupply);
    });

    // 6. Communication
    (rawData.communication_lines_reports || []).forEach(r => {
      const city = r.city;
      const cityData = getCityData(city);
      const isRestored = (r.status_of_communication || '').toLowerCase().includes('restored');
      const update = (obj) => {
        obj.total++;
        if (isRestored) obj.restored++; else obj.interrupted++;
      };
      update(categoryTotals.communicationLines);
      if (cityData) update(cityData.communicationLines);
    });

    // 7. Damaged Houses
    (rawData.damaged_houses_reports || []).forEach(r => {
      const city = r.city;
      const cityData = getCityData(city);
      const update = (obj) => {
        obj.total += ((r.totally_damaged || 0) + (r.partially_damaged || 0));
        obj.totally += (r.totally_damaged || 0);
        obj.partially += (r.partially_damaged || 0);
        obj.amount += Number(r.amount_php || 0);
      };
      update(categoryTotals.damagedHouses);
      if (cityData) update(cityData.damagedHouses);
    });

    // 8. Suspensions / SoC
    (rawData.class_suspension_reports || []).forEach(r => {
      categoryTotals.classSuspension++;
      const cd = getCityData(r.city); if (cd) cd.classSuspension++;
    });
    (rawData.work_suspension_reports || []).forEach(r => {
      categoryTotals.workSuspension++;
      const cd = getCityData(r.city); if (cd) cd.workSuspension++;
    });
    (rawData.declaration_state_of_calamity_reports || []).forEach(r => {
      categoryTotals.stateOfCalamity++;
      const cd = getCityData(r.city); if (cd) cd.stateOfCalamity++;
    });

    // 9. Pre-emptive
    (rawData.pre_emptive_evacuation_reports || []).forEach(r => {
      const city = r.city;
      const cityData = getCityData(city);
      const update = (obj) => {
        obj.families += (r.families || 0);
        obj.persons += (r.persons || (r.families || 0) * 5);
      };
      update(categoryTotals.preEmptiveEvacuation);
      if (cityData) update(cityData.preEmptiveEvacuation);
    });

    const response = {
      cities: Array.from(citiesSet).sort(),
      categoryTotals,
      byCityCategory,
      details: {
        relatedIncidents: rawData.related_incidents || [],
        affectedPopulation: rawData.affected_population || [],
        roadsAndBridges: rawData.roads_and_bridges || [],
        power: rawData.power_reports || [],
        waterSupply: rawData.water_supply_reports || [],
        communicationLines: rawData.communication_lines_reports || [],
        damagedHouses: rawData.damaged_houses_reports || [],
        classSuspension: rawData.class_suspension_reports || [],
        workSuspension: rawData.work_suspension_reports || [],
        stateOfCalamity: rawData.declaration_state_of_calamity_reports || [],
        preEmptiveEvacuation: rawData.pre_emptive_evacuation_reports || [],
        assistanceProvided: rawData.assistance_provided_reports || [],
        assistanceLgusAgencies: rawData.assistance_lgus_agencies_reports || [],
        agricultureDamage: rawData.agriculture_damage_reports || [],
        infrastructureDamage: rawData.infrastructure_damage_reports || [],
      },
      summaryData: {
        // Fallback or placeholders if needed by AI summarizer
      }
    };

    res.json(response);
  } catch (err) {
    console.error('[Reports/Consolidated] CRITICAL ERROR:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});


// GET /api/reports/:table?event_id=&situational_report_id=
router.get('/:table', authenticate, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Unknown table' });
  }

  const { event_id, situational_report_id, report_id } = req.query;
  const conditions = [];
  const params = [];

  if (event_id) {
    params.push(event_id);
    conditions.push(`event_id = $${params.length}`);
  }
  if (situational_report_id) {
    const ids = situational_report_id.split(',').map(id => id.trim());
    params.push(ids);
    conditions.push(`situational_report_id = ANY($${params.length}::uuid[])`);
  }
  if (report_id) {
    const ids = report_id.split(',').map(id => id.trim());
    params.push(ids);
    conditions.push(`report_id = ANY($${params.length}::uuid[])`);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  try {
    const { rows } = await pool.query(`SELECT * FROM ${table} ${where} ORDER BY created_at DESC`, params);
    res.json(rows);
  } catch (err) {
    console.error(`[Reports/GET/${table}] CRITICAL ERROR:`, err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// POST /api/reports/:table  – insert a row
router.post('/:table', authenticate, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Unknown table' });
  }

  const body = req.body;
  const columns = Object.keys(body);
  if (columns.length === 0) return res.status(400).json({ error: 'No fields provided' });

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const values = columns.map(col => {
    const v = body[col];
    return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
  });

  try {
    console.log(`[DB/Post] Inserting into ${table}:`, body);
    const { rows } = await pool.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    const io = req.app.locals.io;
    if (io) io.emit(`${table}:created`, rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(`[Reports/POST/${table}] ERROR:`, err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// POST /api/reports/:table/bulk – insert multiple rows
router.post('/:table/bulk', authenticate, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Unknown table' });
  }

  const data = req.body; // Expect array of objects
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'Array of rows required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];

    for (const row of data) {
      const columns = Object.keys(row);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const values = columns.map(col => {
        const v = row[col];
        return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
      });

      console.log(`[DB/Bulk] Inserting into ${table}:`, row);

      const { rows } = await client.query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      results.push(rows[0]);
    }

    await client.query('COMMIT');
    const io = req.app.locals.io;
    if (io) io.emit(`${table}:bulk_created`, { count: results.length });
    res.status(201).json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Reports/POST/${table}/bulk] ERROR:`, err.message);
    console.error(`[Reports/POST/${table}/bulk] STACK:`, err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/reports/:table/bulk – update multiple rows
router.patch('/:table/bulk', authenticate, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Unknown table' });
  }

  const data = req.body; // Expect array of objects with 'id'
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'Array of rows required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];

    for (const row of data) {
      const { id, ...body } = row;
      if (!id) continue;

      const columns = Object.keys(body);
      if (columns.length === 0) continue;

      const setClauses = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const values = columns.map(col => {
        const v = body[col];
        return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
      });
      values.push(id);

      const { rows } = await client.query(
        `UPDATE ${table} SET ${setClauses} WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (rows.length > 0) results.push(rows[0]);
    }

    await client.query('COMMIT');
    const io = req.app.locals.io;
    if (io) io.emit(`${table}:bulk_updated`, { count: results.length });
    res.json(results);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Reports/PATCH/${table}/bulk]`, err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// PUT /api/reports/:table/:id  – full update
router.put('/:table/:id', authenticate, async (req, res) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Unknown table' });
  }

  const body = req.body;
  const columns = Object.keys(body);
  if (columns.length === 0) return res.status(400).json({ error: 'No fields provided' });

  const setClauses = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const values = columns.map(col => {
    const v = body[col];
    return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
  });
  values.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE ${table} SET ${setClauses} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Row not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(`[Reports/PUT/${table}/${id}]`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/reports/:table/:id
router.delete('/:table/:id', authenticate, async (req, res) => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Unknown table' });
  }
  try {
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(`[Reports/DELETE/${table}/${id}]`, err);
    res.status(500).json({ error: 'Server error' });
  }
});



module.exports = router;

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: 'localhost',
  port: 5434,
  database: 'proact',
  user: 'proact_user',
  password: 'proact_secret',
});

async function checkPower() {
  try {
    const { rows } = await pool.query('SELECT * FROM power_reports ORDER BY created_at DESC LIMIT 5');
    console.log('--- POWER REPORTS ---');
    console.log(JSON.stringify(rows, null, 2));
    
    const { rows: sitreps } = await pool.query('SELECT * FROM situational_reports ORDER BY created_at DESC LIMIT 5');
    console.log('--- SITREPS ---');
    console.log(JSON.stringify(sitreps, null, 2));

    const { rows: events } = await pool.query('SELECT * FROM events ORDER BY created_at DESC LIMIT 5');
    console.log('--- EVENTS ---');
    console.log(JSON.stringify(events, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkPower();

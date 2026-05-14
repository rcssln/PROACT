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
    const { rows } = await pool.query("SELECT * FROM power_reports WHERE city LIKE 'Santo Tomas%' ORDER BY created_at DESC");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkPower();

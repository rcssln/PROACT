const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5434,
  database: 'proact',
  user: 'proact_user',
  password: 'proact_secret',
});

async function checkData() {
  try {
    const sitrepId = 'ec3c9a94-39ec-49a5-9ae3-7a198a93f0bd';
    const { rows } = await pool.query('SELECT * FROM power_reports WHERE situational_report_id = $1', [sitrepId]);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkData();

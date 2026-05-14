const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost', port: 5434, database: 'proact', user: 'proact_user', password: 'proact_secret'
});

async function checkSitreps() {
  const eventId = '0a4910c3-6037-4a29-b3ed-262ac975bdc3';
  const { rows } = await pool.query('SELECT id, status, report_number, province FROM situational_reports WHERE event_id = $1', [eventId]);
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}
checkSitreps();

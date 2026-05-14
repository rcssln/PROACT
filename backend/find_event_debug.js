const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost', port: 5434, database: 'proact', user: 'proact_user', password: 'proact_secret'
});

async function findEvent() {
  const { rows } = await pool.query("SELECT id, name FROM events WHERE name = 'Waks'");
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}
findEvent();

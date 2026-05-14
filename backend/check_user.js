const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: 'localhost',
  port: 5434,
  database: 'proact',
  user: 'proact_user',
  password: 'proact_secret',
});

async function checkUser() {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', ['e635730d-cf87-4c3c-83eb-d33c49a7ccb1']);
    console.log(JSON.stringify(rows[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkUser();

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5434,
  database: 'proact',
  user: 'proact_user',
  password: 'proact_secret',
});

async function checkSitreps() {
  try {
    const ids = ['db6166d6-d89d-4649-b066-fb190acf2356', '631129e8-e5e1-4625-99d0-713ff89f4140'];
    const { rows } = await pool.query('SELECT id, status, report_number FROM situational_reports WHERE id = ANY($1)', [ids]);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkSitreps();

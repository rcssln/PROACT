const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'proact_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'proact',
  password: process.env.DB_PASSWORD || 'proact_secret',
  port: process.env.DB_PORT || 5434,
});

async function checkOwner() {
  try {
    const res = await pool.query("SELECT tableowner FROM pg_tables WHERE tablename = 'report_rows'");
    console.log('Owner of report_rows:', res.rows[0].tableowner);
    
    const currentUser = await pool.query("SELECT current_user");
    console.log('Current user:', currentUser.rows[0].current_user);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkOwner();

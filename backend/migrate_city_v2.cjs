const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Try common postgres credentials if the one in .env fails due to permissions
const pool = new Pool({
  user: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'proact',
  password: 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function migrate() {
  try {
    console.log('Adding city column to report_rows as postgres user...');
    await pool.query("ALTER TABLE report_rows ADD COLUMN IF NOT EXISTS city TEXT DEFAULT ''");
    console.log('Successfully added city column.');
    
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();

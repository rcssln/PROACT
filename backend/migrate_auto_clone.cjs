const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5434'),
  database: process.env.DB_NAME || 'proact',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'proact_secret',
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Adding tracking columns to situational_reports...');
    await client.query(`
      ALTER TABLE situational_reports 
      ADD COLUMN IF NOT EXISTS cloned_from_id UUID REFERENCES situational_reports(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS cloned_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS auto_cloned BOOLEAN DEFAULT FALSE;
    `);

    console.log('Creating index on cloned_from_id...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sitrep_cloned_from ON situational_reports(cloned_from_id);
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

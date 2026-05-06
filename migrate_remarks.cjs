const pool = require('./backend/src/db');

async function migrate() {
  try {
    console.log('Starting migration: Adding remarks to report_rows...');
    await pool.query("ALTER TABLE report_rows ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT '';");
    console.log('Migration successful!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();

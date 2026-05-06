const pool = require('../src/db');

async function fixDb() {
  try {
    console.log('Starting database fix...');
    
    // Add pending_pdf_url to situational_reports
    await pool.query(`
      ALTER TABLE situational_reports 
      ADD COLUMN IF NOT EXISTS pending_pdf_url TEXT;
    `);
    console.log('✓ Added pending_pdf_url to situational_reports');

    // Add remarks to report_rows
    await pool.query(`
      ALTER TABLE report_rows 
      ADD COLUMN IF NOT EXISTS remarks TEXT;
    `);
    console.log('✓ Added remarks to report_rows');

    console.log('Database fix completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error fixing database:', err.message);
    process.exit(1);
  }
}

fixDb();

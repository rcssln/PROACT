const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5434'),
  database: process.env.DB_NAME || 'proact',
  user: process.env.DB_USER || 'proact_user',
  password: process.env.DB_PASSWORD || 'proact_secret',
});

async function migrate() {
  console.log('--- Starting Migration: AI Summaries ---');
  console.log(`Connecting to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

  try {
    const client = await pool.connect();
    console.log('Connected successfully.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ai_summaries (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        situational_report_id UUID NOT NULL REFERENCES public.situational_reports(id) ON DELETE CASCADE,
        summary_text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT ai_summaries_pkey PRIMARY KEY (id)
      );
    `);
    console.log('Table "ai_summaries" created or already exists.');

    // Check if situational_reports has the summary column (it should, but just in case)
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'situational_reports' AND column_name = 'summary'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('Adding "summary" column to "situational_reports"...');
      await client.query('ALTER TABLE situational_reports ADD COLUMN summary TEXT');
    }

    client.release();
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
    process.exit();
  }
}

migrate();

const pool = require('./db');

async function seedAdmin() {
  const adminEmail = 'admin@proact.local';
  const adminPasswordHash = '$2a$12$4RFQwd9YewFlzqZW2y9et.E7eFxPsP5HmG5YsAs3HpruWhBh1Fpzu'; // Admin@1234

  try {
    // 1. Create lgu_submissions table if not exists
    console.log('[Seed] Ensuring lgu_submissions table exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.lgu_submissions (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        situational_report_id UUID NOT NULL REFERENCES public.situational_reports(id) ON DELETE CASCADE,
        city TEXT NOT NULL,
        status TEXT DEFAULT 'Draft',
        rejection_remarks TEXT,
        submitted_by UUID REFERENCES public.users(id),
        approved_by UUID REFERENCES public.users(id),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT lgu_submissions_pkey PRIMARY KEY (id),
        CONSTRAINT lgu_submissions_unique UNIQUE (situational_report_id, city)
      )
    `);

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [adminEmail]);

    if (rows.length === 0) {
      console.log(`[Seed] Creating default admin user: ${adminEmail}`);
      await pool.query(`
        INSERT INTO users (
          email,
          first_name,
          last_name,
          role,
          status,
          account_type,
          password_hash,
          must_change_password
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        adminEmail,
        'System',
        'Admin',
        'Super Admin',
        'Active',
        'Super Admin',
        adminPasswordHash,
        false
      ]);
      console.log('[Seed] Admin user created successfully.');
    } else {
      console.log('[Seed] Admin user already exists.');
    }
  } catch (err) {
    console.error('[Seed] Error seeding admin user or migration:', err);
  }
}

module.exports = { seedAdmin };

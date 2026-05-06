const pool = require('./db');

async function seedAdmin() {
  const adminEmail = 'admin@proact.local';
  const adminPasswordHash = '$2a$12$4RFQwd9YewFlzqZW2y9et.E7eFxPsP5HmG5YsAs3HpruWhBh1Fpzu'; // Admin@1234

  try {
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
    console.error('[Seed] Error seeding admin user:', err);
  }
}

module.exports = { seedAdmin };

const pool = require('./backend/src/db');
(async () => {
  try {
    const sr = await pool.query("SELECT id, title, status, event_id FROM situational_reports WHERE status = 'Approved'");
    console.log('Approved SitReps:', sr.rows);
    
    const dh = await pool.query("SELECT * FROM damaged_houses_reports");
    console.log('All Damaged Houses entries:', dh.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();

const { getPool } = require('../config/db');

(async () => {
  try {
    const pool = await getPool();
    console.log('Connected to DB.');

    // Let's see if we have showtimes
    const result = await pool.request().query("SELECT ShowtimeID, StartTime, Status FROM Showtimes");
    console.log(`Found ${result.recordset.length} showtimes.`);

    if (result.recordset.length > 0) {
      // Update all showtimes to be active and start in the future (e.g. tomorrow)
      await pool.request().query(`
        UPDATE Showtimes 
        SET StartTime = DATEADD(day, 1, GETDATE()), Status = 'active'
      `);
      console.log('Successfully updated all showtimes to start tomorrow and be active!');
    }

    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();

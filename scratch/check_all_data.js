const { getPool } = require('../config/db');
require('dotenv').config();

async function check() {
  try {
    const pool = await getPool();
    const cinemas = await pool.request().query('SELECT * FROM Cinemas');
    console.log('Cinemas:', cinemas.recordset);

    const showtimes = await pool.request().query(`
      SELECT CAST(StartTime AS DATE) as Date, COUNT(*) as Count 
      FROM Showtimes 
      WHERE Status = 'active'
      GROUP BY CAST(StartTime AS DATE)
      ORDER BY Date
    `);
    console.log('Active showtimes by date:', showtimes.recordset);

    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();

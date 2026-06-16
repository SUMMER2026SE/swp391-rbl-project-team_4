const { getPool } = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    const pool = await getPool();
    
    // Update showtimes price logic: Saturday/Sunday/Holidays = 110000, others = 85000
    const updateResult = await pool.request().query(`
      UPDATE Showtimes
      SET BasePrice = CASE 
          -- Saturday (6) and Sunday (0)
          WHEN (DATEPART(dw, StartTime) + @@DATEFIRST - 1) % 7 IN (0, 6) THEN 110000
          -- Holidays (Jan 1, Apr 30, May 1, Sep 2, Sep 3)
          WHEN FORMAT(StartTime, 'MM-dd') IN ('01-01', '04-30', '05-01', '09-02', '09-03') THEN 110000
          ELSE 85000
      END
    `);
    console.log('Update result:', updateResult);

    // Verify by listing counts by price
    const verifyResult = await pool.request().query(`
      SELECT BasePrice, COUNT(*) as Count
      FROM Showtimes
      GROUP BY BasePrice
    `);
    console.log('Verification result:', verifyResult.recordset);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();

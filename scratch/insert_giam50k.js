const { getPool, sql } = require('../config/db');

async function run() {
  try {
    const pool = await getPool();
    // Check if GIAM50K already exists
    const check = await pool.request()
      .input('code', sql.VarChar, 'GIAM50K')
      .query('SELECT * FROM Vouchers WHERE Code = @code');
      
    if (check.recordset.length > 0) {
      console.log('GIAM50K already exists. Updating...');
      await pool.request()
        .input('code', sql.VarChar, 'GIAM50K')
        .input('val', sql.Decimal(18,2), 50.0)
        .input('min', sql.Decimal(18,2), 1.0)
        .input('limit', sql.Int, 50)
        .input('start', sql.Date, '2026-06-15')
        .input('end', sql.Date, '2026-06-20')
        .query(`UPDATE Vouchers 
                SET DiscountType = 'fixed', DiscountValue = @val, MinOrderValue = @min, MaxDiscount = NULL, 
                    UsageLimit = @limit, StartDate = @start, EndDate = @end, IsActive = 1 
                WHERE Code = @code`);
      console.log('Updated GIAM50K successfully.');
    } else {
      console.log('Inserting GIAM50K...');
      await pool.request()
        .input('code', sql.VarChar, 'GIAM50K')
        .input('val', sql.Decimal(18,2), 50.0)
        .input('min', sql.Decimal(18,2), 1.0)
        .input('limit', sql.Int, 50)
        .input('start', sql.Date, '2026-06-15')
        .input('end', sql.Date, '2026-06-20')
        .query(`INSERT INTO Vouchers (Code, DiscountType, DiscountValue, MinOrderValue, MaxDiscount, UsageLimit, StartDate, EndDate, IsActive)
                VALUES (@code, 'fixed', @val, @min, NULL, @limit, @start, @end, 1)`);
      console.log('Inserted GIAM50K successfully.');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error inserting voucher:', err);
    process.exit(1);
  }
}

run();

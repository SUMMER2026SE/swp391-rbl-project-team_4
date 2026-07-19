const { getPool } = require('../config/db');

async function test() {
  try {
    console.log('Connecting to database...');
    const pool = await getPool();
    console.log('Database connected successfully. Schema ensured.');

    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Voucher' AND COLUMN_NAME = 'VoucherType'
    `);
    
    console.log('Column VoucherType details:');
    console.log(result.recordset);
    
    const countResult = await pool.request().query(`
      SELECT TOP 5 VoucherID, VoucherCode, VoucherType, VoucherName FROM Voucher
    `);
    console.log('First 5 vouchers:');
    console.table(countResult.recordset);
    
    process.exit(0);
  } catch (err) {
    console.error('Error during test:', err);
    process.exit(1);
  }
}

test();

const { getPool } = require('../config/db');

async function check() {
  try {
    const pool = await getPool();
    const resPlural = await pool.request().query('SELECT * FROM Vouchers');
    console.log('--- PLURAL Vouchers TABLE CONTENT ---');
    console.table(resPlural.recordset);

    const resSingular = await pool.request().query('SELECT * FROM Voucher');
    console.log('--- SINGULAR Voucher TABLE CONTENT ---');
    console.table(resSingular.recordset);
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();

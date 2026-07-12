require('dotenv').config();
const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    console.log('--- dbo.Promotions ---');
    const res = await pool.request().query('SELECT * FROM dbo.Promotions');
    console.log('Total promotions in DB:', res.recordset.length);
    console.log(res.recordset);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();

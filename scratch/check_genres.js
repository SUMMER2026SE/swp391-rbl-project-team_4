const { getPool } = require('../config/db');

async function test() {
  const pool = await getPool();
  const r = await pool.request().query("SELECT Title, MainCast FROM Movies");
  console.log(r.recordset.filter(m => m.Title.includes('Hỏa') || m.Title.includes('Thịnh Nộ')));
  process.exit(0);
}
test();

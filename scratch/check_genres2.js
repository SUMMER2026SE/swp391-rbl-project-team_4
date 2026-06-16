const { getPool } = require('../config/db');

async function test() {
  const pool = await getPool();
  const r = await pool.request().query("SELECT * FROM Genres");
  console.log(r.recordset);
  process.exit(0);
}
test();

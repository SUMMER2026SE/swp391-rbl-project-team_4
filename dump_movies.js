const { getPool } = require('./config/db');
(async () => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM Movies");
    console.log(JSON.stringify(result.recordset, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
})();

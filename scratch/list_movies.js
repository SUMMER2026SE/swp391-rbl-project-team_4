const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Movies');
    console.log('--- MOVIES LIST ---');
    console.log(JSON.stringify(result.recordset, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error listing movies:', err);
    process.exit(1);
  }
}

main();

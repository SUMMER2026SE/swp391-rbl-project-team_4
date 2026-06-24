const { getPool } = require('../config/db');
require('dotenv').config();

async function check() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT MovieID, Title, Status, PosterURL, Duration, AgeRating
      FROM Movies
    `);
    console.log('All Movies in Database:');
    console.table(result.recordset);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();

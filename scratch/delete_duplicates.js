const { getPool, sql } = require('../config/db');

async function deleteDuplicates() {
  const pool = await getPool();
  try {
    // Delete duplicate movies
    await pool.request().query("DELETE FROM Movies WHERE MovieID IN (10, 11, 12, 13, 14, 15)");
    console.log("Deleted duplicate movies successfully!");
  } catch(e) {
    console.error("Failed to delete duplicates", e);
  } finally {
    process.exit(0);
  }
}

deleteDuplicates();

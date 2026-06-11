const { getPool } = require('../config/db');

(async () => {
  try {
    const pool = await getPool();
    console.log("Connected to DB, updating trailer URL for John Wick: Chapter 4...");

    await pool.request().query(`
      UPDATE Movies 
      SET TrailerURL = 'https://www.youtube.com/watch?v=2AUmvWm5ZDQ'
      WHERE Title = N'John Wick: Chapter 4';
    `);

    console.log("Successfully updated trailer URL!");
  } catch (err) {
    console.error("Failed to update trailer URL:", err);
  } finally {
    process.exit(0);
  }
})();

const { getPool } = require('../config/db');

(async () => {
  try {
    const pool = await getPool();
    console.log("Connected to DB, updating poster image for John Wick: Chapter 4...");

    await pool.request().query(`
      UPDATE Movies 
      SET PosterURL = 'images/john_wick_4.png'
      WHERE Title = N'John Wick: Chapter 4';
    `);

    console.log("Successfully updated poster image in database!");
  } catch (err) {
    console.error("Failed to update poster image:", err);
  } finally {
    process.exit(0);
  }
})();

const { getPool } = require('../config/db');
require('dotenv').config();

async function check() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT m.MovieID, m.Title, m.MainCast,
             (SELECT STRING_AGG(g.GenreName, ', ') 
              FROM Movie_Genres mg 
              JOIN Genres g ON mg.GenreID = g.GenreID 
              WHERE mg.MovieID = m.MovieID) AS Genre
      FROM Movies m
    `);
    console.log('Movies & Genres:', JSON.stringify(result.recordset, null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();

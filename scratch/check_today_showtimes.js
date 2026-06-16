const { getPool } = require('../config/db');
require('dotenv').config();

async function check() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT st.ShowtimeID, st.StartTime, st.EndTime, st.Status,
             m.MovieID, m.Title, m.MainCast,
             (SELECT STRING_AGG(g.GenreName, ', ') 
              FROM Movie_Genres mg 
              JOIN Genres g ON mg.GenreID = g.GenreID 
              WHERE mg.MovieID = m.MovieID) AS Genre
      FROM Showtimes st
      JOIN Rooms r ON st.RoomID = r.RoomID
      JOIN Movies m ON st.MovieID = m.MovieID
      WHERE r.CinemaID = 11
        AND CAST(st.StartTime AS DATE) = '2026-06-16'
        AND st.Status = 'active'
    `);
    console.log("Showtimes for Cinema 11 on 2026-06-16:", JSON.stringify(result.recordset, null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();

const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT m.Title, c.CinemaName, COUNT(st.ShowtimeID) AS ShowtimeCount
      FROM Movies m
      CROSS JOIN Cinemas c
      LEFT JOIN Rooms r ON r.CinemaID = c.CinemaID
      LEFT JOIN Showtimes st ON st.MovieID = m.MovieID AND st.RoomID = r.RoomID
      WHERE m.Status = 'Now Showing'
      GROUP BY m.Title, c.CinemaName
      ORDER BY m.Title, ShowtimeCount ASC
    `);
    console.log('--- SHOWTIME COUNTS FOR NOW SHOWING MOVIES PER CINEMA ---');
    console.table(result.recordset);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();

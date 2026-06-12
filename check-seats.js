const { getPool } = require('./config/db');

async function check() {
  try {
    const pool = await getPool();

    console.log('--- Room & Seats Count ---');
    const rooms = await pool.request().query(`
      SELECT r.RoomID, r.CinemaID, c.CinemaName, r.RoomName, r.TotalSeats,
             (SELECT COUNT(*) FROM Seats s WHERE s.RoomID = r.RoomID) as ActualSeatsCount
      FROM Rooms r
      JOIN Cinemas c ON r.CinemaID = c.CinemaID
      ORDER BY r.CinemaID, r.RoomID
    `);
    console.log(rooms.recordset);

    console.log('\n--- Movies and Posters ---');
    const movies = await pool.request().query('SELECT MovieID, Title, PosterURL, Status FROM Movies');
    console.log(movies.recordset);

    console.log('\n--- Showtimes without Seats ---');
    const stNoSeats = await pool.request().query(`
      SELECT st.ShowtimeID, st.StartTime, m.Title, c.CinemaName, r.RoomName,
             (SELECT COUNT(*) FROM Seats s WHERE s.RoomID = r.RoomID) as SeatsCount
      FROM Showtimes st
      JOIN Rooms r ON st.RoomID = r.RoomID
      JOIN Cinemas c ON r.CinemaID = c.CinemaID
      JOIN Movies m ON st.MovieID = m.MovieID
      WHERE (SELECT COUNT(*) FROM Seats s WHERE s.RoomID = r.RoomID) = 0
    `);
    console.log(stNoSeats.recordset);

    console.log('\n--- Sync Price from BasePrice (where Price is NULL) ---');
    const syncResult = await pool.request().query(`
      UPDATE Showtimes SET Price = BasePrice WHERE Price IS NULL AND BasePrice IS NOT NULL;
      SELECT @@ROWCOUNT AS UpdatedRows;
    `);
    console.log('Synced rows:', syncResult.recordset[0]?.UpdatedRows ?? 0);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();

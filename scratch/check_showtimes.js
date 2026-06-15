const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    const count = await pool.request().query('SELECT COUNT(*) AS cnt FROM Showtimes');
    console.log('Total showtimes:', count.recordset[0].cnt);

    const showtimes = await pool.request().query(`
      SELECT TOP 10 st.ShowtimeID, st.MovieID, m.Title, st.RoomID, st.StartTime, st.EndTime, st.Status
      FROM Showtimes st
      JOIN Movies m ON st.MovieID = m.MovieID
      ORDER BY st.StartTime DESC
    `);
    console.log('Recent 10 showtimes:');
    console.log(JSON.stringify(showtimes.recordset, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();

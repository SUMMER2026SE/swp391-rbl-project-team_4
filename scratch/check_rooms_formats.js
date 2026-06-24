const { getPool } = require('../config/db');
require('dotenv').config();

async function check() {
  try {
    const pool = await getPool();
    const rooms = await pool.request().query("SELECT * FROM Rooms WHERE RoomName LIKE '%IMAX%' OR RoomName LIKE '%3D%'");
    console.log('IMAX or 3D Rooms:');
    console.table(rooms.recordset);

    const showtimes = await pool.request().query(`
      SELECT st.ShowtimeID, m.Title, r.RoomName
      FROM Showtimes st
      JOIN Rooms r ON st.RoomID = r.RoomID
      JOIN Movies m ON st.MovieID = m.MovieID
      WHERE r.RoomName LIKE '%IMAX%' OR r.RoomName LIKE '%3D%'
    `);
    console.log('Showtimes in IMAX or 3D Rooms:');
    console.table(showtimes.recordset);

    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();

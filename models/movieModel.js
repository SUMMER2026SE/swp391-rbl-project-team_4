const { sql, getPool } = require('../config/db');

class MovieModel {
  static async getNowShowing() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT MovieID, Title, Description, Director, Duration, AgeRating,
             TrailerURL, PosterURL, Status, MainCast
      FROM   Movies
      WHERE  Status = 'Now Showing'
      ORDER BY MovieID DESC
    `);
    return result.recordset;
  }

  static async getComingSoon() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT MovieID, Title, Description, Director, Duration, AgeRating,
             TrailerURL, PosterURL, Status, MainCast
      FROM   Movies
      WHERE  Status = 'Coming Soon'
      ORDER BY MovieID ASC
    `);
    return result.recordset;
  }

  static async getAllMovies({ status, search }) {
    const pool = await getPool();
    const request = pool.request();

    let whereClause = 'WHERE 1=1';
    if (status) {
      request.input('status', sql.NVarChar, status);
      whereClause += ' AND Status = @status';
    }
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      whereClause += ' AND Title LIKE @search';
    }

    const result = await request.query(`
      SELECT MovieID, Title, Description, Director, Duration, AgeRating,
             TrailerURL, PosterURL, Status, MainCast
      FROM   Movies
      ${whereClause}
      ORDER BY MovieID DESC
    `);
    return result.recordset;
  }

  static async getMovieById(movieId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('movieId', sql.Int, parseInt(movieId))
      .query(`
        SELECT MovieID, Title, Description, Director, Duration, AgeRating,
               TrailerURL, PosterURL, Status, MainCast
        FROM   Movies
        WHERE  MovieID = @movieId
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async getShowtimesByMovie(movieId, date) {
    const pool = await getPool();
    const request = pool.request().input('movieId', sql.Int, parseInt(movieId));

    let dateFilter = '';
    if (date) {
      request.input('date', sql.Date, date);
      dateFilter = 'AND CAST(st.StartTime AS DATE) = @date';
    }

    const result = await request.query(`
      SELECT st.ShowtimeID, st.StartTime, st.EndTime, st.Price, st.Status,
             r.RoomID, r.RoomName, r.TotalSeats,
             c.CinemaID, c.CinemaName, c.Address
      FROM   Showtimes st
      JOIN   Rooms   r ON st.RoomID   = r.RoomID
      JOIN   Cinemas c ON r.CinemaID  = c.CinemaID
      WHERE  st.MovieID = @movieId
        AND  st.Status  = 'active'
        ${dateFilter}
      ORDER BY st.StartTime ASC
    `);
    return result.recordset;
  }

  static async getSeatsByShowtime(showtimeId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('showtimeId', sql.Int, parseInt(showtimeId))
      .query(`
        SELECT s.SeatID, s.SeatRow, s.SeatNumber, s.SeatType,
               CASE WHEN t.SeatID IS NOT NULL THEN 'booked' ELSE 'available' END AS SeatStatus
        FROM   Seats s
        JOIN   Showtimes st ON s.RoomID = st.RoomID
        LEFT   JOIN Tickets t ON t.SeatID = s.SeatID AND t.ShowtimeID = @showtimeId
                              AND t.Status IN ('confirmed', 'pending')
        WHERE  st.ShowtimeID = @showtimeId
        ORDER BY s.SeatRow, s.SeatNumber
      `);
    return result.recordset;
  }
}

module.exports = MovieModel;

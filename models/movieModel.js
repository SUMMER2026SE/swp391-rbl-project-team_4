const { sql, getPool } = require('../config/db');

class MovieModel {
  static async getNowShowing() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT m.MovieID, m.Title, m.Description, m.Director, m.Duration, m.AgeRating, m.TrailerURL, m.PosterURL, m.Status,
             COALESCE(
               (SELECT STRING_AGG(g.GenreName, ', ') 
                FROM Movie_Genres mg 
                JOIN Genres g ON mg.GenreID = g.GenreID 
                WHERE mg.MovieID = m.MovieID),
               m.Genre
             ) AS Genre
      FROM   Movies m
      WHERE  m.Status = 'Now Showing'
      ORDER BY m.MovieID DESC
    `);
    return result.recordset;
  }

  static async getComingSoon() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT m.MovieID, m.Title, m.Description, m.Director, m.Duration, m.AgeRating, m.TrailerURL, m.PosterURL, m.Status,
             COALESCE(
               (SELECT STRING_AGG(g.GenreName, ', ') 
                FROM Movie_Genres mg 
                JOIN Genres g ON mg.GenreID = g.GenreID 
                WHERE mg.MovieID = m.MovieID),
               m.Genre
             ) AS Genre
      FROM   Movies m
      WHERE  m.Status = 'Coming Soon'
      ORDER BY m.MovieID ASC
    `);
    return result.recordset;
  }

  static async getAllMovies({ status, genre, search }) {
    const pool = await getPool();
    const request = pool.request();

    let whereClause = 'WHERE 1=1';
    if (status) {
      request.input('status', sql.NVarChar, status);
      whereClause += ' AND m.Status = @status';
    }
    if (genre) {
      request.input('genre', sql.NVarChar, genre);
      whereClause += ' AND EXISTS (SELECT 1 FROM Movie_Genres mg2 JOIN Genres g2 ON mg2.GenreID = g2.GenreID WHERE mg2.MovieID = m.MovieID AND g2.GenreName = @genre)';
    }
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      whereClause += ' AND m.Title LIKE @search';
    }

    const result = await request.query(`
      SELECT m.MovieID, m.Title, m.Description, m.Director, m.Duration, m.AgeRating, m.TrailerURL, m.PosterURL, m.Status,
             COALESCE(
               (SELECT STRING_AGG(g.GenreName, ', ') 
                FROM Movie_Genres mg 
                JOIN Genres g ON mg.GenreID = g.GenreID 
                WHERE mg.MovieID = m.MovieID),
               m.Genre
             ) AS Genre
      FROM   Movies m
      ${whereClause}
      ORDER BY m.MovieID DESC
    `);
    return result.recordset;
  }

  static async getMovieById(movieId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('movieId', sql.Int, parseInt(movieId))
      .query(`
        SELECT m.MovieID, m.Title, m.Description, m.Director, m.Duration, m.AgeRating, m.TrailerURL, m.PosterURL, m.Status, m.MainCast,
               COALESCE(
                 (SELECT STRING_AGG(g.GenreName, ', ') 
                  FROM Movie_Genres mg 
                  JOIN Genres g ON mg.GenreID = g.GenreID 
                  WHERE mg.MovieID = m.MovieID),
                 m.Genre
               ) AS Genre
        FROM   Movies m
        WHERE  m.MovieID = @movieId
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
      SELECT st.ShowtimeID, st.StartTime, st.EndTime, st.BasePrice AS Price,
             r.RoomID, r.RoomName, r.TotalSeats,
             c.CinemaID, c.CinemaName, c.Address
      FROM   Showtimes st
      JOIN   Rooms   r ON st.RoomID   = r.RoomID
      JOIN   Cinemas c ON r.CinemaID  = c.CinemaID
      WHERE  st.MovieID = @movieId
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

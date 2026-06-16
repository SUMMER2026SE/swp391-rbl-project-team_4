const { sql, getPool } = require('../config/db');

const moviePosters = {
  1: 'images/movie_neon_dreams.png',
  2: 'images/movie_lastnoir.png',
  3: 'images/movie_summer_echoes.png',
  4: 'images/movie_odyssey.png',
  5: 'images/movie_oppenheimer.png',
  6: 'images/movie_velocity.png',
  7: 'images/movie_nebula.png',
  8: 'images/movie_interstellar.png'
};

function assignDynamicPoster(movie) {
  if (!movie) return;
  if (!movie.PosterURL && moviePosters[movie.MovieID]) {
    movie.PosterURL = moviePosters[movie.MovieID];
  }
}

class MovieModel {
  static async getNowShowing(city) {
    const pool = await getPool();
    const request = pool.request();
    let query = `
      SELECT m.MovieID, m.Title, m.Description, m.Director, m.Duration, m.AgeRating,
             m.TrailerURL, m.PosterURL, m.Status, m.MainCast,
             (SELECT STRING_AGG(g.GenreName, ', ') 
              FROM Movie_Genres mg 
              JOIN Genres g ON mg.GenreID = g.GenreID 
              WHERE mg.MovieID = m.MovieID) AS Genres,
             COALESCE((SELECT STRING_AGG(Format, ', ') 
                       FROM (SELECT DISTINCT CASE 
                               WHEN r.RoomName LIKE '%3D%' THEN '3D'
                               WHEN r.RoomName LIKE '%IMAX%' THEN 'IMAX'
                               ELSE '2D'
                             END AS Format 
                             FROM Showtimes st 
                             JOIN Rooms r ON st.RoomID = r.RoomID 
                             WHERE st.MovieID = m.MovieID AND st.Status = 'active') AS Formats), '2D') AS Formats
      FROM   Movies m
    `;
    if (city && city !== 'Toàn quốc') {
      request.input('city', sql.NVarChar, city);
      query += `
        WHERE m.Status = 'Now Showing'
          AND EXISTS (
            SELECT 1 FROM Showtimes st
            JOIN Rooms r ON st.RoomID = r.RoomID
            JOIN Cinemas c ON r.CinemaID = c.CinemaID
            WHERE st.MovieID = m.MovieID AND c.City = @city AND st.StartTime > GETDATE() AND st.Status = 'active'
          )
      `;
    } else {
      query += ` WHERE m.Status = 'Now Showing' `;
    }
    query += ` ORDER BY m.MovieID DESC `;

    const result = await request.query(query);
    result.recordset.forEach(assignDynamicPoster);
    return result.recordset;
  }

  static async getComingSoon() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT m.MovieID, m.Title, m.Description, m.Director, m.Duration, m.AgeRating,
             m.TrailerURL, m.PosterURL, m.Status, m.MainCast,
             (SELECT STRING_AGG(g.GenreName, ', ') 
              FROM Movie_Genres mg 
              JOIN Genres g ON mg.GenreID = g.GenreID 
              WHERE mg.MovieID = m.MovieID) AS Genres,
             COALESCE((SELECT STRING_AGG(Format, ', ') 
                       FROM (SELECT DISTINCT CASE 
                               WHEN r.RoomName LIKE '%3D%' THEN '3D'
                               WHEN r.RoomName LIKE '%IMAX%' THEN 'IMAX'
                               ELSE '2D'
                             END AS Format 
                             FROM Showtimes st 
                             JOIN Rooms r ON st.RoomID = r.RoomID 
                             WHERE st.MovieID = m.MovieID AND st.Status = 'active') AS Formats), '2D') AS Formats
      FROM   Movies m
      WHERE  m.Status = 'Coming Soon'
      ORDER BY m.MovieID ASC
    `);
    result.recordset.forEach(assignDynamicPoster);
    return result.recordset;
  }

  static async getAllMovies({ status, genre, search }) {
    const pool = await getPool();
    const request = pool.request();

    let whereClause = "WHERE m.Status != 'deleted'";
    if (status) {
      request.input('status', sql.NVarChar, status);
      whereClause += ' AND m.Status = @status';
    }
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      whereClause += ' AND m.Title LIKE @search';
    }
    if (genre) {
      request.input('genre', sql.NVarChar, genre);
      whereClause += ' AND EXISTS (SELECT 1 FROM Movie_Genres mg2 JOIN Genres g2 ON mg2.GenreID = g2.GenreID WHERE mg2.MovieID = m.MovieID AND g2.GenreName = @genre)';
    }

    const result = await request.query(`
      SELECT m.MovieID, m.Title, m.Description, m.Director, m.Duration, m.AgeRating,
             m.TrailerURL, m.PosterURL, m.Status, m.MainCast,
             (SELECT STRING_AGG(g.GenreName, ', ') 
              FROM Movie_Genres mg 
              JOIN Genres g ON mg.GenreID = g.GenreID 
              WHERE mg.MovieID = m.MovieID) AS Genres,
             COALESCE((SELECT STRING_AGG(Format, ', ') 
                       FROM (SELECT DISTINCT CASE 
                               WHEN r.RoomName LIKE '%3D%' THEN '3D'
                               WHEN r.RoomName LIKE '%IMAX%' THEN 'IMAX'
                               ELSE '2D'
                             END AS Format 
                             FROM Showtimes st 
                             JOIN Rooms r ON st.RoomID = r.RoomID 
                             WHERE st.MovieID = m.MovieID AND st.Status = 'active') AS Formats), '2D') AS Formats
      FROM   Movies m
      ${whereClause}
      ORDER BY m.MovieID DESC
    `);
    result.recordset.forEach(assignDynamicPoster);
    return result.recordset;
  }

  static async getMovieById(movieId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('movieId', sql.Int, parseInt(movieId))
      .query(`
        SELECT m.MovieID, m.Title, m.Description, m.Director, m.Duration, m.AgeRating,
               m.TrailerURL, m.PosterURL, m.Status, m.MainCast,
               (SELECT STRING_AGG(g.GenreName, ', ') 
                FROM Movie_Genres mg 
                JOIN Genres g ON mg.GenreID = g.GenreID 
                WHERE mg.MovieID = m.MovieID) AS Genres,
               COALESCE((SELECT STRING_AGG(Format, ', ') 
                         FROM (SELECT DISTINCT CASE 
                                 WHEN r.RoomName LIKE '%3D%' THEN '3D'
                                 WHEN r.RoomName LIKE '%IMAX%' THEN 'IMAX'
                                 ELSE '2D'
                               END AS Format 
                               FROM Showtimes st 
                               JOIN Rooms r ON st.RoomID = r.RoomID 
                               WHERE st.MovieID = m.MovieID AND st.Status = 'active') AS Formats), '2D') AS Formats
        FROM   Movies m
        WHERE  m.MovieID = @movieId
      `);
    if (result.recordset.length > 0) {
      assignDynamicPoster(result.recordset[0]);
    }
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
      SELECT st.ShowtimeID, st.StartTime, st.EndTime,
             COALESCE(st.Price, st.BasePrice, 0) AS Price, st.Status,
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
        SELECT s.SeatID, s.SeatRow, s.SeatNumber, s.SeatType, s.PriceMultiplier,
               CASE WHEN t.SeatID IS NOT NULL THEN 'booked' ELSE 'available' END AS SeatStatus
        FROM   Seats s
        JOIN   Showtimes st ON s.RoomID = st.RoomID
        LEFT   JOIN Tickets t ON t.SeatID = s.SeatID AND t.ShowtimeID = @showtimeId
                              AND t.Status IN ('confirmed', 'pending')
        WHERE  st.ShowtimeID = @showtimeId
          AND  s.SeatType != 'None'
        ORDER BY s.SeatRow, s.SeatNumber
      `);
    return result.recordset;
  }

  static async getCinemas() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT CinemaID, CinemaName, Name, Address, City
      FROM   Cinemas
      ORDER BY City, CinemaName
    `);
    return result.recordset;
  }

  static async getShowtimeDetails(showtimeId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('showtimeId', sql.Int, parseInt(showtimeId))
      .query(`
        SELECT st.ShowtimeID, st.StartTime, st.EndTime,
               COALESCE(st.Price, st.BasePrice, 0) AS Price, st.Status,
               r.RoomID, r.RoomName, r.TotalSeats,
               c.CinemaID, c.CinemaName, c.Address,
               m.MovieID, m.Title, m.Duration, m.AgeRating, m.PosterURL, m.MainCast
        FROM   Showtimes st
        JOIN   Rooms   r ON st.RoomID   = r.RoomID
        JOIN   Cinemas c ON r.CinemaID  = c.CinemaID
        JOIN   Movies  m ON st.MovieID  = m.MovieID
        WHERE  st.ShowtimeID = @showtimeId
      `);
    if (result.recordset.length > 0) {
      assignDynamicPoster(result.recordset[0]);
    }
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async getShowtimes({ cinemaId, date, movieId }) {
    const pool = await getPool();
    const request = pool.request();
    request.input('cinemaId', sql.Int, parseInt(cinemaId));
    request.input('date', sql.Date, date);

    let movieFilter = '';
    if (movieId) {
      request.input('movieId', sql.Int, parseInt(movieId));
      movieFilter = 'AND st.MovieID = @movieId';
    }

    const result = await request.query(`
      SELECT st.ShowtimeID, st.StartTime, st.EndTime,
             COALESCE(st.Price, st.BasePrice, 0) AS Price, st.Status,
             r.RoomID, r.RoomName, r.TotalSeats,
             m.MovieID, m.Title, m.Duration, m.AgeRating, m.PosterURL, m.MainCast,
             (SELECT STRING_AGG(g.GenreName, ', ') 
              FROM Movie_Genres mg 
              JOIN Genres g ON mg.GenreID = g.GenreID 
              WHERE mg.MovieID = m.MovieID) AS Genre,
             (SELECT COUNT(*)
              FROM Seats s
              WHERE s.RoomID = r.RoomID AND s.SeatType != 'None'
                AND NOT EXISTS (
                  SELECT 1 FROM Tickets tk
                  WHERE tk.SeatID = s.SeatID AND tk.ShowtimeID = st.ShowtimeID
                    AND tk.Status IN ('confirmed', 'pending')
                )
             ) AS AvailableSeats,
             (SELECT COUNT(*)
              FROM Tickets tk
              WHERE tk.ShowtimeID = st.ShowtimeID AND tk.Status IN ('confirmed', 'pending')
             ) AS TicketsSold
      FROM   Showtimes st
      JOIN   Rooms   r ON st.RoomID   = r.RoomID
      JOIN   Cinemas c ON r.CinemaID  = c.CinemaID
      JOIN   Movies  m ON st.MovieID  = m.MovieID
      WHERE  r.CinemaID = @cinemaId
        AND  CAST(st.StartTime AS DATE) = @date
        AND  st.Status  = 'active'
        AND  st.StartTime > GETDATE()
        ${movieFilter}
      ORDER BY m.Title, st.StartTime ASC
    `);
    result.recordset.forEach(assignDynamicPoster);
    return result.recordset;
  }
}

module.exports = MovieModel;

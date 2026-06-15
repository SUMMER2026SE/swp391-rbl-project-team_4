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
      SELECT DISTINCT m.MovieID, m.Title, m.Description, m.Director, m.Duration, m.AgeRating,
             m.TrailerURL, m.PosterURL, m.Status, m.MainCast
      FROM   Movies m
    `;
    if (city && city !== 'Toàn quốc') {
      request.input('city', sql.NVarChar, city);
      query += `
        JOIN Showtimes st ON m.MovieID = st.MovieID
        JOIN Rooms r ON st.RoomID = r.RoomID
        JOIN Cinemas c ON r.CinemaID = c.CinemaID
        WHERE m.Status = 'Now Showing' AND c.City = @city AND st.StartTime > GETDATE()
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
      SELECT MovieID, Title, Description, Director, Duration, AgeRating,
             TrailerURL, PosterURL, Status, MainCast
      FROM   Movies
      WHERE  Status = 'Coming Soon'
      ORDER BY MovieID ASC
    `);
    result.recordset.forEach(assignDynamicPoster);
    return result.recordset;
  }

  static async getAllMovies({ status, search }) {
    const pool = await getPool();
    const request = pool.request();

    let whereClause = "WHERE Status != 'deleted'";
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
    result.recordset.forEach(assignDynamicPoster);
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

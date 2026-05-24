// ============================================================
//  controllers/movieController.js  –  Movie & Showtime APIs
//  Dành cho: Khách vãng lai (không cần đăng nhập)
// ============================================================
const { getPool, sql } = require('../config/db');

// ─────────────────────────────────────────────────────────────
//  GET /api/movies/now-showing
//  Lấy danh sách phim đang chiếu
// ─────────────────────────────────────────────────────────────
exports.getNowShowing = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT MovieID, Title, Genre, Duration, Rating, Description,
             PosterURL, TrailerURL, ReleaseDate, Status
      FROM   Movies
      WHERE  Status = 'now-showing'
      ORDER BY ReleaseDate DESC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[movieController] getNowShowing:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/movies/coming-soon
//  Lấy danh sách phim sắp chiếu
// ─────────────────────────────────────────────────────────────
exports.getComingSoon = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT MovieID, Title, Genre, Duration, Rating, Description,
             PosterURL, TrailerURL, ReleaseDate, Status
      FROM   Movies
      WHERE  Status = 'coming-soon'
      ORDER BY ReleaseDate ASC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[movieController] getComingSoon:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/movies
//  Lấy tất cả phim (có thể filter bằng query ?status=now-showing&genre=Action)
// ─────────────────────────────────────────────────────────────
exports.getAllMovies = async (req, res) => {
  try {
    const { status, genre, search } = req.query;
    const pool = await getPool();
    const request = pool.request();

    let whereClause = 'WHERE 1=1';
    if (status) {
      request.input('status', sql.NVarChar, status);
      whereClause += ' AND Status = @status';
    }
    if (genre) {
      request.input('genre', sql.NVarChar, genre);
      whereClause += ' AND Genre = @genre';
    }
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      whereClause += ' AND Title LIKE @search';
    }

    const result = await request.query(`
      SELECT MovieID, Title, Genre, Duration, Rating, Description,
             PosterURL, TrailerURL, ReleaseDate, Status
      FROM   Movies
      ${whereClause}
      ORDER BY ReleaseDate DESC
    `);
    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    console.error('[movieController] getAllMovies:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/movies/:id
//  Chi tiết một bộ phim
// ─────────────────────────────────────────────────────────────
exports.getMovieById = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('movieId', sql.Int, parseInt(req.params.id))
      .query(`
        SELECT MovieID, Title, Genre, Duration, Rating, Description,
               PosterURL, TrailerURL, ReleaseDate, Status
        FROM   Movies
        WHERE  MovieID = @movieId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phim.' });
    }
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('[movieController] getMovieById:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/movies/:id/showtimes
//  Lịch chiếu của một bộ phim (filter theo ngày: ?date=2024-12-25)
// ─────────────────────────────────────────────────────────────
exports.getShowtimesByMovie = async (req, res) => {
  try {
    const { date } = req.query;
    const pool = await getPool();
    const request = pool.request().input('movieId', sql.Int, parseInt(req.params.id));

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
    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    console.error('[movieController] getShowtimesByMovie:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/movies/showtimes/:showtimeId/seats
//  Trạng thái ghế ngồi của một suất chiếu
// ─────────────────────────────────────────────────────────────
exports.getSeatsByShowtime = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('showtimeId', sql.Int, parseInt(req.params.showtimeId))
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
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[movieController] getSeatsByShowtime:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

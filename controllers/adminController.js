// ============================================================
//  controllers/adminController.js  –  Admin / Manager APIs
//  Dành cho: Quản lý (Role: Admin, Manager)
// ============================================================
const { getPool, sql } = require('../config/db');

// ════════════════════════════════════════════════════════════
//  MOVIE MANAGEMENT
// ════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  POST /api/admin/movies
//  Thêm phim mới
//  Body: { title, genre, duration, rating, description, posterURL, trailerURL, releaseDate, status }
// ─────────────────────────────────────────────────────────────
exports.createMovie = async (req, res) => {
  try {
    const { title, genre, duration, rating, description, posterURL, trailerURL, releaseDate, status } = req.body;

    if (!title || !genre || !duration || !releaseDate) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: title, genre, duration, releaseDate.' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('title', sql.NVarChar, title)
      .input('genre', sql.NVarChar, genre)
      .input('duration', sql.Int, duration)
      .input('rating', sql.Decimal, rating || null)
      .input('description', sql.NVarChar, description || null)
      .input('posterURL', sql.NVarChar, posterURL || null)
      .input('trailerURL', sql.NVarChar, trailerURL || null)
      .input('releaseDate', sql.Date, releaseDate)
      .input('status', sql.NVarChar, status || 'coming-soon')
      .query(`
        INSERT INTO Movies (Title, Genre, Duration, Rating, Description,
                            PosterURL, TrailerURL, ReleaseDate, Status, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@title, @genre, @duration, @rating, @description,
                @posterURL, @trailerURL, @releaseDate, @status, GETDATE())
      `);

    res.status(201).json({ success: true, message: 'Thêm phim thành công!', data: result.recordset[0] });
  } catch (err) {
    console.error('[adminController] createMovie:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/admin/movies/:id
//  Cập nhật thông tin phim
// ─────────────────────────────────────────────────────────────
exports.updateMovie = async (req, res) => {
  try {
    const { title, genre, duration, rating, description, posterURL, trailerURL, releaseDate, status } = req.body;
    const movieId = parseInt(req.params.id);

    const pool = await getPool();
    const result = await pool.request()
      .input('movieId', sql.Int, movieId)
      .input('title', sql.NVarChar, title)
      .input('genre', sql.NVarChar, genre)
      .input('duration', sql.Int, duration)
      .input('rating', sql.Decimal, rating)
      .input('description', sql.NVarChar, description)
      .input('posterURL', sql.NVarChar, posterURL)
      .input('trailerURL', sql.NVarChar, trailerURL)
      .input('releaseDate', sql.Date, releaseDate)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE Movies
        SET Title       = COALESCE(@title, Title),
            Genre       = COALESCE(@genre, Genre),
            Duration    = COALESCE(@duration, Duration),
            Rating      = COALESCE(@rating, Rating),
            Description = COALESCE(@description, Description),
            PosterURL   = COALESCE(@posterURL, PosterURL),
            TrailerURL  = COALESCE(@trailerURL, TrailerURL),
            ReleaseDate = COALESCE(@releaseDate, ReleaseDate),
            Status      = COALESCE(@status, Status),
            UpdatedAt   = GETDATE()
        OUTPUT INSERTED.*
        WHERE MovieID = @movieId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phim.' });
    }
    res.json({ success: true, message: 'Cập nhật phim thành công!', data: result.recordset[0] });
  } catch (err) {
    console.error('[adminController] updateMovie:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/admin/movies/:id
//  Xóa phim (soft delete — đổi status = 'deleted')
// ─────────────────────────────────────────────────────────────
exports.deleteMovie = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('movieId', sql.Int, parseInt(req.params.id))
      .query(`UPDATE Movies SET Status = 'deleted' WHERE MovieID = @movieId`);
    res.json({ success: true, message: 'Đã xóa phim.' });
  } catch (err) {
    console.error('[adminController] deleteMovie:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ════════════════════════════════════════════════════════════
//  SHOWTIME MANAGEMENT
// ════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  GET /api/admin/showtimes
//  Lấy tất cả suất chiếu (filter: ?movieId=1&date=2024-12-25)
// ─────────────────────────────────────────────────────────────
exports.getAllShowtimes = async (req, res) => {
  try {
    const { movieId, date, cinemaId } = req.query;
    const pool = await getPool();
    const request = pool.request();

    let filters = 'WHERE 1=1';
    if (movieId) { request.input('movieId', sql.Int, parseInt(movieId)); filters += ' AND st.MovieID = @movieId'; }
    if (date) { request.input('date', sql.Date, date); filters += ' AND CAST(st.StartTime AS DATE) = @date'; }
    if (cinemaId) { request.input('cinemaId', sql.Int, parseInt(cinemaId)); filters += ' AND c.CinemaID = @cinemaId'; }

    const result = await request.query(`
      SELECT st.ShowtimeID, st.StartTime, st.EndTime, st.Price, st.Status,
             m.Title AS MovieTitle,
             r.RoomName, r.TotalSeats,
             c.CinemaName,
             COUNT(t.TicketID) AS TicketsSold
      FROM   Showtimes st
      JOIN   Movies  m ON st.MovieID = m.MovieID
      JOIN   Rooms   r ON st.RoomID  = r.RoomID
      JOIN   Cinemas c ON r.CinemaID = c.CinemaID
      LEFT   JOIN Tickets t ON t.ShowtimeID = st.ShowtimeID AND t.Status IN ('confirmed','pending')
      ${filters}
      GROUP BY st.ShowtimeID, st.StartTime, st.EndTime, st.Price, st.Status,
               m.Title, r.RoomName, r.TotalSeats, c.CinemaName
      ORDER BY st.StartTime DESC
    `);
    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    console.error('[adminController] getAllShowtimes:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/admin/showtimes
//  Tạo suất chiếu mới
//  Body: { movieId, roomId, startTime, endTime, price }
// ─────────────────────────────────────────────────────────────
exports.createShowtime = async (req, res) => {
  try {
    const { movieId, roomId, startTime, endTime, price } = req.body;

    if (!movieId || !roomId || !startTime || !endTime || price == null) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin: movieId, roomId, startTime, endTime, price.' });
    }

    const pool = await getPool();

    // --- Kiểm tra phòng không bị trùng giờ ---
    const conflictCheck = await pool.request()
      .input('roomId', sql.Int, roomId)
      .input('startTime', sql.DateTime, startTime)
      .input('endTime', sql.DateTime, endTime)
      .query(`
        SELECT ShowtimeID FROM Showtimes
        WHERE RoomID = @roomId AND Status = 'active'
          AND NOT (@endTime <= StartTime OR @startTime >= EndTime)
      `);

    if (conflictCheck.recordset.length > 0) {
      return res.status(409).json({ success: false, message: 'Phòng chiếu đã có lịch trong khung giờ này.' });
    }

    const result = await pool.request()
      .input('movieId', sql.Int, movieId)
      .input('roomId', sql.Int, roomId)
      .input('startTime', sql.DateTime, startTime)
      .input('endTime', sql.DateTime, endTime)
      .input('price', sql.Decimal, price)
      .query(`
        INSERT INTO Showtimes (MovieID, RoomID, StartTime, EndTime, Price, Status)
        OUTPUT INSERTED.*
        VALUES (@movieId, @roomId, @startTime, @endTime, @price, 'active')
      `);

    res.status(201).json({ success: true, message: 'Tạo suất chiếu thành công!', data: result.recordset[0] });
  } catch (err) {
    console.error('[adminController] createShowtime:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/admin/showtimes/:id
//  Cập nhật hoặc hủy suất chiếu
// ─────────────────────────────────────────────────────────────
exports.updateShowtime = async (req, res) => {
  try {
    const { startTime, endTime, price, status } = req.body;
    const pool = await getPool();
    const result = await pool.request()
      .input('showtimeId', sql.Int, parseInt(req.params.id))
      .input('startTime', sql.DateTime, startTime)
      .input('endTime', sql.DateTime, endTime)
      .input('price', sql.Decimal, price)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE Showtimes
        SET StartTime = COALESCE(@startTime, StartTime),
            EndTime   = COALESCE(@endTime, EndTime),
            Price     = COALESCE(@price, Price),
            Status    = COALESCE(@status, Status)
        OUTPUT INSERTED.*
        WHERE ShowtimeID = @showtimeId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy suất chiếu.' });
    }
    res.json({ success: true, message: 'Cập nhật suất chiếu thành công!', data: result.recordset[0] });
  } catch (err) {
    console.error('[adminController] updateShowtime:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ════════════════════════════════════════════════════════════
//  USER MANAGEMENT
// ════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  GET /api/admin/users
//  Danh sách tất cả người dùng
// ─────────────────────────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT u.UserID, u.FullName, u.Email, u.Phone, u.IsActive, u.CreatedAt,
             r.RoleName
      FROM   Users u
      JOIN   Roles r ON u.RoleID = r.RoleID
      ORDER BY u.CreatedAt DESC
    `);
    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    console.error('[adminController] getAllUsers:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  PATCH /api/admin/users/:id/role
//  Thay đổi vai trò người dùng
//  Body: { roleName: 'Staff' | 'Manager' | 'Customer' }
// ─────────────────────────────────────────────────────────────
exports.changeUserRole = async (req, res) => {
  try {
    const { roleName } = req.body;
    const pool = await getPool();

    const roleResult = await pool.request()
      .input('roleName', sql.NVarChar, roleName)
      .query('SELECT RoleID FROM Roles WHERE RoleName = @roleName');

    if (roleResult.recordset.length === 0) {
      return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ.' });
    }

    await pool.request()
      .input('userId', sql.Int, parseInt(req.params.id))
      .input('roleId', sql.Int, roleResult.recordset[0].RoleID)
      .query('UPDATE Users SET RoleID = @roleId WHERE UserID = @userId');

    res.json({ success: true, message: `Đã đổi vai trò người dùng sang ${roleName}.` });
  } catch (err) {
    console.error('[adminController] changeUserRole:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  PATCH /api/admin/users/:id/toggle-status
//  Kích hoạt / Vô hiệu hóa tài khoản
// ─────────────────────────────────────────────────────────────
exports.toggleUserStatus = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('userId', sql.Int, parseInt(req.params.id))
      .query('UPDATE Users SET IsActive = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END WHERE UserID = @userId');
    res.json({ success: true, message: 'Đã thay đổi trạng thái tài khoản.' });
  } catch (err) {
    console.error('[adminController] toggleUserStatus:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ════════════════════════════════════════════════════════════
//  VOUCHER MANAGEMENT
// ════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  GET /api/admin/vouchers  — Danh sách voucher
// ─────────────────────────────────────────────────────────────
exports.getAllVouchers = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT VoucherID, Code, DiscountType, DiscountValue, MinOrderValue,
             MaxDiscount, UsageLimit, UsedCount, StartDate, EndDate, IsActive
      FROM   Vouchers
      ORDER BY EndDate DESC
    `);
    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    console.error('[adminController] getAllVouchers:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/admin/vouchers  — Tạo voucher mới
//  Body: { code, discountType, discountValue, minOrderValue, maxDiscount, usageLimit, startDate, endDate }
// ─────────────────────────────────────────────────────────────
exports.createVoucher = async (req, res) => {
  try {
    const { code, discountType, discountValue, minOrderValue, maxDiscount, usageLimit, startDate, endDate } = req.body;

    if (!code || !discountType || discountValue == null || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc.' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('code', sql.NVarChar, code.toUpperCase())
      .input('discountType', sql.NVarChar, discountType)
      .input('discountValue', sql.Decimal, discountValue)
      .input('minOrderValue', sql.Decimal, minOrderValue || 0)
      .input('maxDiscount', sql.Decimal, maxDiscount || null)
      .input('usageLimit', sql.Int, usageLimit || null)
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .query(`
        INSERT INTO Vouchers (Code, DiscountType, DiscountValue, MinOrderValue,
                              MaxDiscount, UsageLimit, UsedCount, StartDate, EndDate, IsActive)
        OUTPUT INSERTED.*
        VALUES (@code, @discountType, @discountValue, @minOrderValue,
                @maxDiscount, @usageLimit, 0, @startDate, @endDate, 1)
      `);

    res.status(201).json({ success: true, message: 'Tạo voucher thành công!', data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627) { // Unique constraint violation
      return res.status(409).json({ success: false, message: 'Mã voucher đã tồn tại.' });
    }
    console.error('[adminController] createVoucher:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ════════════════════════════════════════════════════════════
//  STATISTICS / REVENUE REPORTS
// ════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  GET /api/admin/stats/revenue
//  Thống kê doanh thu (filter: ?startDate=&endDate=&movieId=&cinemaId=)
// ─────────────────────────────────────────────────────────────
exports.getRevenueStats = async (req, res) => {
  try {
    const { startDate, endDate, movieId, cinemaId } = req.query;
    const pool = await getPool();
    const request = pool.request();

    let filters = "WHERE t.Status IN ('confirmed', 'used')";
    if (startDate) { request.input('startDate', sql.Date, startDate); filters += ' AND CAST(t.BookedAt AS DATE) >= @startDate'; }
    if (endDate) { request.input('endDate', sql.Date, endDate); filters += ' AND CAST(t.BookedAt AS DATE) <= @endDate'; }
    if (movieId) { request.input('movieId', sql.Int, parseInt(movieId)); filters += ' AND st.MovieID = @movieId'; }
    if (cinemaId) { request.input('cinemaId', sql.Int, parseInt(cinemaId)); filters += ' AND c.CinemaID = @cinemaId'; }

    const result = await request.query(`
      SELECT
        COUNT(t.TicketID)        AS TotalTickets,
        SUM(t.TotalAmount)       AS TotalRevenue,
        AVG(t.TotalAmount)       AS AvgTicketRevenue,
        m.Title                  AS MovieTitle,
        c.CinemaName,
        CAST(t.BookedAt AS DATE) AS BookingDate
      FROM   Tickets t
      JOIN   Showtimes st ON t.ShowtimeID = st.ShowtimeID
      JOIN   Movies    m  ON st.MovieID   = m.MovieID
      JOIN   Rooms     r  ON st.RoomID    = r.RoomID
      JOIN   Cinemas   c  ON r.CinemaID   = c.CinemaID
      ${filters}
      GROUP BY m.Title, c.CinemaName, CAST(t.BookedAt AS DATE)
      ORDER BY BookingDate DESC
    `);

    // Tổng hợp summary
    const summaryResult = await pool.request().query(`
      SELECT COUNT(TicketID) AS TotalTickets, SUM(TotalAmount) AS TotalRevenue
      FROM   Tickets
      WHERE  Status IN ('confirmed', 'used')
    `);

    res.json({
      success: true,
      summary: summaryResult.recordset[0],
      data: result.recordset,
    });
  } catch (err) {
    console.error('[adminController] getRevenueStats:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/admin/stats/dashboard
//  Tổng quan dashboard: số phim, suất chiếu hôm nay, doanh thu hôm nay
// ─────────────────────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM Movies WHERE Status = 'now-showing')                                      AS MoviesNowShowing,
        (SELECT COUNT(*) FROM Movies WHERE Status = 'coming-soon')                                      AS MoviesComingSoon,
        (SELECT COUNT(*) FROM Showtimes WHERE CAST(StartTime AS DATE) = CAST(GETDATE() AS DATE))        AS ShowtimesToday,
        (SELECT COUNT(*) FROM Tickets WHERE Status IN ('confirmed','used'))                              AS TotalTicketsSold,
        (SELECT ISNULL(SUM(TotalAmount), 0) FROM Tickets
         WHERE Status IN ('confirmed','used')
           AND CAST(BookedAt AS DATE) = CAST(GETDATE() AS DATE))                                        AS RevenueToday,
        (SELECT ISNULL(SUM(TotalAmount), 0) FROM Tickets
         WHERE Status IN ('confirmed','used')
           AND MONTH(BookedAt) = MONTH(GETDATE())
           AND YEAR(BookedAt)  = YEAR(GETDATE()))                                                       AS RevenueThisMonth,
        (SELECT COUNT(*) FROM Users)                                                                     AS TotalUsers
    `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('[adminController] getDashboardStats:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/admin/stats/top-movies
//  Top phim có doanh thu cao nhất
// ─────────────────────────────────────────────────────────────
exports.getTopMovies = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          m.MovieID, m.Title, m.Genre, m.PosterURL,
          COUNT(t.TicketID)  AS TotalTickets,
          SUM(t.TotalAmount) AS TotalRevenue
        FROM   Tickets t
        JOIN   Showtimes st ON t.ShowtimeID = st.ShowtimeID
        JOIN   Movies    m  ON st.MovieID   = m.MovieID
        WHERE  t.Status IN ('confirmed', 'used')
        GROUP BY m.MovieID, m.Title, m.Genre, m.PosterURL
        ORDER BY TotalRevenue DESC
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[adminController] getTopMovies:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

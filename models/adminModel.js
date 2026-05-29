const { sql, getPool } = require('../config/db');

class AdminModel {
  // --- MOVIE MANAGEMENT ---
  static async createMovie(data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('title', sql.NVarChar, data.title)
      .input('genre', sql.NVarChar, data.genre)
      .input('duration', sql.Int, data.duration)
      .input('rating', sql.Decimal, data.rating || null)
      .input('description', sql.NVarChar, data.description || null)
      .input('posterURL', sql.NVarChar, data.posterURL || null)
      .input('trailerURL', sql.NVarChar, data.trailerURL || null)
      .input('releaseDate', sql.Date, data.releaseDate)
      .input('status', sql.NVarChar, data.status || 'coming-soon')
      .query(`
        INSERT INTO Movies (Title, Genre, Duration, Rating, Description,
                            PosterURL, TrailerURL, ReleaseDate, Status, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@title, @genre, @duration, @rating, @description,
                @posterURL, @trailerURL, @releaseDate, @status, GETDATE())
      `);
    return result.recordset[0];
  }

  static async updateMovie(movieId, data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('movieId', sql.Int, movieId)
      .input('title', sql.NVarChar, data.title)
      .input('genre', sql.NVarChar, data.genre)
      .input('duration', sql.Int, data.duration)
      .input('rating', sql.Decimal, data.rating)
      .input('description', sql.NVarChar, data.description)
      .input('posterURL', sql.NVarChar, data.posterURL)
      .input('trailerURL', sql.NVarChar, data.trailerURL)
      .input('releaseDate', sql.Date, data.releaseDate)
      .input('status', sql.NVarChar, data.status)
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
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async deleteMovie(movieId) {
    const pool = await getPool();
    await pool.request()
      .input('movieId', sql.Int, movieId)
      .query(`UPDATE Movies SET Status = 'deleted' WHERE MovieID = @movieId`);
  }

  // --- SHOWTIME MANAGEMENT ---
  static async getAllShowtimes({ movieId, date, cinemaId }) {
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
    return result.recordset;
  }

  static async createShowtime(data) {
    const pool = await getPool();

    // Check conflict
    const conflictCheck = await pool.request()
      .input('roomId', sql.Int, data.roomId)
      .input('startTime', sql.DateTime, data.startTime)
      .input('endTime', sql.DateTime, data.endTime)
      .query(`
        SELECT ShowtimeID FROM Showtimes
        WHERE RoomID = @roomId AND Status = 'active'
          AND NOT (@endTime <= StartTime OR @startTime >= EndTime)
      `);

    if (conflictCheck.recordset.length > 0) {
      throw new Error('Phòng chiếu đã có lịch trong khung giờ này.');
    }

    const result = await pool.request()
      .input('movieId', sql.Int, data.movieId)
      .input('roomId', sql.Int, data.roomId)
      .input('startTime', sql.DateTime, data.startTime)
      .input('endTime', sql.DateTime, data.endTime)
      .input('price', sql.Decimal, data.price)
      .query(`
        INSERT INTO Showtimes (MovieID, RoomID, StartTime, EndTime, Price, Status)
        OUTPUT INSERTED.*
        VALUES (@movieId, @roomId, @startTime, @endTime, @price, 'active')
      `);
    return result.recordset[0];
  }

  static async updateShowtime(showtimeId, data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('showtimeId', sql.Int, showtimeId)
      .input('startTime', sql.DateTime, data.startTime)
      .input('endTime', sql.DateTime, data.endTime)
      .input('price', sql.Decimal, data.price)
      .input('status', sql.NVarChar, data.status)
      .query(`
        UPDATE Showtimes
        SET StartTime = COALESCE(@startTime, StartTime),
            EndTime   = COALESCE(@endTime, EndTime),
            Price     = COALESCE(@price, Price),
            Status    = COALESCE(@status, Status)
        OUTPUT INSERTED.*
        WHERE ShowtimeID = @showtimeId
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  // --- USER MANAGEMENT ---
  static async getAllUsers() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT u.UserID, u.FullName, u.Email, u.Phone, u.IsActive, u.CreatedAt,
             r.RoleName
      FROM   Users u
      JOIN   Roles r ON u.RoleID = r.RoleID
      ORDER BY u.CreatedAt DESC
    `);
    return result.recordset;
  }

  static async changeUserRole(userId, roleName) {
    const pool = await getPool();
    const roleResult = await pool.request()
      .input('roleName', sql.NVarChar, roleName)
      .query('SELECT RoleID FROM Roles WHERE RoleName = @roleName');

    if (roleResult.recordset.length === 0) {
      throw new Error('Vai trò không hợp lệ.');
    }

    await pool.request()
      .input('userId', sql.Int, userId)
      .input('roleId', sql.Int, roleResult.recordset[0].RoleID)
      .query('UPDATE Users SET RoleID = @roleId WHERE UserID = @userId');
  }

  static async toggleUserStatus(userId) {
    const pool = await getPool();
    await pool.request()
      .input('userId', sql.Int, userId)
      .query('UPDATE Users SET IsActive = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END WHERE UserID = @userId');
  }

  // --- VOUCHER MANAGEMENT ---
  static async getAllVouchers() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT VoucherID, Code, DiscountType, DiscountValue, MinOrderValue,
             MaxDiscount, UsageLimit, UsedCount, StartDate, EndDate, IsActive
      FROM   Vouchers
      ORDER BY EndDate DESC
    `);
    return result.recordset;
  }

  static async createVoucher(data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('code', sql.NVarChar, data.code.toUpperCase())
      .input('discountType', sql.NVarChar, data.discountType)
      .input('discountValue', sql.Decimal, data.discountValue)
      .input('minOrderValue', sql.Decimal, data.minOrderValue || 0)
      .input('maxDiscount', sql.Decimal, data.maxDiscount || null)
      .input('usageLimit', sql.Int, data.usageLimit || null)
      .input('startDate', sql.Date, data.startDate)
      .input('endDate', sql.Date, data.endDate)
      .query(`
        INSERT INTO Vouchers (Code, DiscountType, DiscountValue, MinOrderValue,
                              MaxDiscount, UsageLimit, UsedCount, StartDate, EndDate, IsActive)
        OUTPUT INSERTED.*
        VALUES (@code, @discountType, @discountValue, @minOrderValue,
                @maxDiscount, @usageLimit, 0, @startDate, @endDate, 1)
      `);
    return result.recordset[0];
  }

  // --- STATISTICS ---
  static async getRevenueStats({ startDate, endDate, movieId, cinemaId }) {
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

    const summaryResult = await pool.request().query(`
      SELECT COUNT(TicketID) AS TotalTickets, SUM(TotalAmount) AS TotalRevenue
      FROM   Tickets
      WHERE  Status IN ('confirmed', 'used')
    `);

    return { summary: summaryResult.recordset[0], data: result.recordset };
  }

  static async getDashboardStats() {
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
    return result.recordset[0];
  }

  static async getTopMovies(limit) {
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
    return result.recordset;
  }
}

module.exports = AdminModel;

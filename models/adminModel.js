const { sql, getPool } = require('../config/db');

class AdminModel {
  // --- MOVIE MANAGEMENT ---
  static async createMovie(data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('title', sql.NVarChar, data.title)
      .input('description', sql.NVarChar, data.description || null)
      .input('director', sql.NVarChar, data.director || null)
      .input('duration', sql.Int, data.duration)
      .input('ageRating', sql.VarChar, data.ageRating || null)
      .input('posterURL', sql.VarChar, data.posterURL || null)
      .input('status', sql.VarChar, data.status || 'Coming Soon')
      .input('mainCast', sql.NVarChar, data.mainCast || null)
      .query(`
        INSERT INTO Movies (Title, Description, Director, Duration, AgeRating, PosterURL, Status, MainCast)
        OUTPUT INSERTED.*
        VALUES (@title, @description, @director, @duration, @ageRating, @posterURL, @status, @mainCast)
      `);
    return result.recordset[0];
  }

  static async updateMovie(movieId, data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('movieId', sql.Int, movieId)
      .input('title', sql.NVarChar, data.title)
      .input('description', sql.NVarChar, data.description)
      .input('director', sql.NVarChar, data.director)
      .input('duration', sql.Int, data.duration)
      .input('ageRating', sql.VarChar, data.ageRating)
      .input('posterURL', sql.VarChar, data.posterURL)
      .input('status', sql.VarChar, data.status)
      .input('mainCast', sql.NVarChar, data.mainCast)
      .query(`
        UPDATE Movies
        SET Title       = COALESCE(@title, Title),
            Description = COALESCE(@description, Description),
            Director    = COALESCE(@director, Director),
            Duration    = COALESCE(@duration, Duration),
            AgeRating   = COALESCE(@ageRating, AgeRating),
            PosterURL   = COALESCE(@posterURL, PosterURL),
            Status      = COALESCE(@status, Status),
            MainCast    = COALESCE(@mainCast, MainCast)
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

  // --- F&B MANAGEMENT ---
  static async getAllFnB() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT FnBID, Name, Description, Category, Price, Stock, ImageURL, IsAvailable
      FROM FoodBeverages
      ORDER BY Category, Name
    `);
    return result.recordset;
  }

  static async createFnB(data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, data.name)
      .input('description', sql.NVarChar, data.description || null)
      .input('category', sql.NVarChar, data.category || 'Combos')
      .input('price', sql.Decimal, data.price)
      .input('stock', sql.Int, data.stock || 0)
      .input('imageURL', sql.VarChar, data.imageURL || 'images/default_fnb.png')
      .input('isAvailable', sql.Bit, data.isAvailable !== false ? 1 : 0)
      .query(`
        INSERT INTO FoodBeverages (Name, Description, Category, Price, Stock, ImageURL, IsAvailable)
        OUTPUT INSERTED.*
        VALUES (@name, @description, @category, @price, @stock, @imageURL, @isAvailable)
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
      DECLARE @TotalSeats INT = (SELECT ISNULL(SUM(r.TotalSeats), 1) FROM Showtimes st JOIN Rooms r ON st.RoomID = r.RoomID);
      DECLARE @TotalTickets INT = (SELECT COUNT(*) FROM BookingTickets bt JOIN Bookings b ON bt.BookingID = b.BookingID);

      SELECT
        (SELECT ISNULL(SUM(TotalAmount), 0) FROM Bookings) AS TotalRevenue,
        (SELECT COUNT(*) FROM BookingTickets) AS TicketSales,
        (
          SELECT ISNULL(SUM(bf.Quantity * bf.Price), 0)
          FROM Booking_FnB bf
        ) AS FnBSales,
        (CAST(@TotalTickets * 100.0 / @TotalSeats AS DECIMAL(5,1))) AS OccupancyRate
    `);
    return result.recordset[0];
  }

  static async getRecentTransactions(limit = 10) {
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          '#TXN-' + RIGHT('0000' + CAST(b.BookingID AS VARCHAR(10)), 4) AS id,
          c.Name AS branch,
          'Ticket: ' + m.Title AS item,
          FORMAT(b.BookingTime, 'dd MMM, HH:mm') AS date,
          '$' + CAST(CAST(b.TotalAmount / 24000.0 AS DECIMAL(10,2)) AS VARCHAR(20)) AS amount,
          UPPER(b.PaymentStatus) AS status
        FROM Bookings b
        JOIN Showtimes st ON b.ShowtimeID = st.ShowtimeID
        JOIN Movies m ON st.MovieID = m.MovieID
        JOIN Rooms r ON st.RoomID = r.RoomID
        JOIN Cinemas c ON r.CinemaID = c.CinemaID
        ORDER BY b.BookingTime DESC
      `);
    return result.recordset;
  }

  static async getMonthlyRevenue(year) {
    const pool = await getPool();
    const result = await pool.request()
      .input('year', sql.Int, year || new Date().getFullYear())
      .query(`
        WITH Months AS (
            SELECT 1 AS MonthNumber UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
            UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
            UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
        )
        SELECT 
            m.MonthNumber,
            (
                SELECT ISNULL(SUM(bt.Price), 0) 
                FROM BookingTickets bt
                JOIN Bookings b ON bt.BookingID = b.BookingID
                WHERE MONTH(b.BookingTime) = m.MonthNumber AND YEAR(b.BookingTime) = @year
            ) AS TicketRevenue,
            (
                SELECT ISNULL(SUM(bf.Quantity * bf.Price), 0) 
                FROM Booking_FnB bf
                JOIN Bookings b ON bf.BookingID = b.BookingID
                WHERE MONTH(b.BookingTime) = m.MonthNumber AND YEAR(b.BookingTime) = @year
            ) AS FnBRevenue
        FROM Months m
        ORDER BY m.MonthNumber
      `);
    return result.recordset;
  }

  static async getTopMovies(limit) {
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          m.MovieID, m.Title, m.PosterURL,
          (
             SELECT ISNULL(SUM(b2.TotalAmount), 0) 
             FROM Bookings b2 
             JOIN Showtimes st2 ON b2.ShowtimeID = st2.ShowtimeID
             WHERE st2.MovieID = m.MovieID
               AND CAST(b2.BookingTime AS DATE) = CAST(GETDATE() AS DATE)
          ) AS TodayRevenue,
          COUNT(bt.TicketID)  AS TotalTickets
        FROM   BookingTickets bt
        JOIN   Bookings b ON bt.BookingID = b.BookingID
        JOIN   Showtimes st ON b.ShowtimeID = st.ShowtimeID
        JOIN   Movies    m  ON st.MovieID   = m.MovieID
        GROUP BY m.MovieID, m.Title, m.PosterURL
        ORDER BY TodayRevenue DESC, TotalTickets DESC
      `);
    return result.recordset;
  }
}

module.exports = AdminModel;

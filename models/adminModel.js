const { sql, getPool } = require('../config/db');

let schemaReady = false;
let genreSchemaReady = false;
let reviewSchemaReady = false;
let roomTypeSchemaReady = false;

// 4 loại phòng hợp lệ duy nhất trong hệ thống
const VALID_ROOM_TYPES = ['Standard', 'IMAX Laser', '2D', '3D'];

async function ensureRoomTypeSchema() {
  if (roomTypeSchemaReady) return;
  const pool = await getPool();

  await pool.request().query(`
    IF COL_LENGTH('dbo.Rooms', 'RoomType') IS NULL
    BEGIN
      ALTER TABLE dbo.Rooms
      ADD RoomType NVARCHAR(50) NOT NULL
          CONSTRAINT DF_Rooms_RoomType DEFAULT 'Standard' WITH VALUES;
    END;
  `);

  // 1. Migrate dữ liệu cũ về 4 loại chuẩn
  await pool.request().query(`
    UPDATE Rooms SET RoomType = 'Standard'
    WHERE RoomType IS NULL
       OR RoomType = ''
       OR RoomType = '2D Standard'
       OR RoomType = '4DX'
       OR RoomType = 'ScreenX';

    UPDATE Rooms SET RoomType = 'IMAX Laser'
    WHERE RoomType = 'IMAX';
  `);

  roomTypeSchemaReady = true;
  console.log('[AdminModel] Room type schema ensured: Standard, IMAX Laser, 2D, 3D');
}

async function ensureMovieReviewsTable() {
  if (reviewSchemaReady) return;
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.MovieReviews', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.MovieReviews (
        ReviewID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        MovieID INT NOT NULL,
        UserID INT NOT NULL,
        Rating INT NOT NULL,
        Comment NVARCHAR(1000) NULL,
        IsVisible BIT NOT NULL CONSTRAINT DF_MovieReviews_IsVisible DEFAULT 1,
        CreatedAt DATETIME NOT NULL CONSTRAINT DF_MovieReviews_CreatedAt DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT CK_MovieReviews_Rating CHECK (Rating BETWEEN 1 AND 5),
        CONSTRAINT UQ_MovieReviews_Movie_User UNIQUE (MovieID, UserID),
        CONSTRAINT FK_MovieReviews_Movies FOREIGN KEY (MovieID) REFERENCES dbo.Movies(MovieID),
        CONSTRAINT FK_MovieReviews_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
      );
    END;

    IF COL_LENGTH('dbo.MovieReviews', 'IsVisible') IS NULL
    BEGIN
      ALTER TABLE dbo.MovieReviews ADD IsVisible BIT NOT NULL CONSTRAINT DF_MovieReviews_IsVisible DEFAULT 1;
    END;

    IF COL_LENGTH('dbo.MovieReviews', 'CreatedAt') IS NULL
    BEGIN
      ALTER TABLE dbo.MovieReviews ADD CreatedAt DATETIME NOT NULL CONSTRAINT DF_MovieReviews_CreatedAt DEFAULT GETDATE();
    END;

    IF COL_LENGTH('dbo.MovieReviews', 'UpdatedAt') IS NULL
    BEGIN
      ALTER TABLE dbo.MovieReviews ADD UpdatedAt DATETIME NULL;
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'IX_MovieReviews_MovieID_IsVisible'
        AND object_id = OBJECT_ID('dbo.MovieReviews')
    )
    BEGIN
      CREATE INDEX IX_MovieReviews_MovieID_IsVisible
      ON dbo.MovieReviews (MovieID, IsVisible)
      INCLUDE (Rating, CreatedAt, UpdatedAt);
    END;
  `);
  reviewSchemaReady = true;
}

async function ensurePromotionsTable() {
  if (schemaReady) return;
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.Promotions', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Promotions (
        PromotionID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(1000) NULL,
        BadgeLabel NVARCHAR(80) NULL,
        ImageURL VARCHAR(500) NULL,
        LinkURL VARCHAR(500) NULL,
        IsFeatured BIT NOT NULL CONSTRAINT DF_Promotions_IsFeatured DEFAULT 0,
        IsActive BIT NOT NULL CONSTRAINT DF_Promotions_IsActive DEFAULT 1,
        SortOrder INT NOT NULL CONSTRAINT DF_Promotions_SortOrder DEFAULT 0,
        CreatedAt DATETIME NOT NULL CONSTRAINT DF_Promotions_CreatedAt DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL
      );
    END;
  `);
  schemaReady = true;
}

async function ensureGenreTables() {
  if (genreSchemaReady) return;
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.Genres', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Genres (
        GenreID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        GenreName NVARCHAR(100) NOT NULL UNIQUE,
        IsActive BIT NOT NULL CONSTRAINT DF_Genres_IsActive DEFAULT 1,
        CreatedAt DATETIME NOT NULL CONSTRAINT DF_Genres_CreatedAt DEFAULT GETDATE()
      );
    END;

    IF COL_LENGTH('dbo.Genres', 'IsActive') IS NULL
    BEGIN
      ALTER TABLE dbo.Genres ADD IsActive BIT NOT NULL CONSTRAINT DF_Genres_IsActive DEFAULT 1;
    END;

    IF OBJECT_ID('dbo.Movie_Genres', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Movie_Genres (
        MovieID INT NOT NULL,
        GenreID INT NOT NULL,
        CONSTRAINT PK_Movie_Genres PRIMARY KEY (MovieID, GenreID),
        CONSTRAINT FK_MovieGenres_Movies FOREIGN KEY (MovieID) REFERENCES dbo.Movies(MovieID),
        CONSTRAINT FK_MovieGenres_Genres FOREIGN KEY (GenreID) REFERENCES dbo.Genres(GenreID)
      );
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Genres)
    BEGIN
      INSERT INTO dbo.Genres (GenreName)
      VALUES
        (N'Hành động'),
        (N'Phiêu lưu'),
        (N'Hài'),
        (N'Tình cảm'),
        (N'Tâm lý'),
        (N'Kinh dị'),
        (N'Hoạt hình'),
        (N'Gia đình'),
        (N'Khoa học viễn tưởng'),
        (N'Tội phạm'),
        (N'Tài liệu');
    END;
  `);
  genreSchemaReady = true;
}

function parseGenreIds(value) {
  if (Array.isArray(value)) value = value.join(',');
  return String(value || '')
    .split(',')
    .map(id => parseInt(id, 10))
    .filter((id, index, arr) => Number.isInteger(id) && id > 0 && arr.indexOf(id) === index);
}

async function syncMovieGenres(poolOrTransaction, movieId, genreIds) {
  const ids = parseGenreIds(genreIds);
  const requestFactory = () => poolOrTransaction.request();

  await requestFactory()
    .input('movieId', sql.Int, movieId)
    .query('DELETE FROM Movie_Genres WHERE MovieID = @movieId');

  for (const genreId of ids) {
    await requestFactory()
      .input('movieId', sql.Int, movieId)
      .input('genreId', sql.Int, genreId)
      .query(`
        IF EXISTS (SELECT 1 FROM Genres WHERE GenreID = @genreId)
        BEGIN
          INSERT INTO Movie_Genres (MovieID, GenreID)
          VALUES (@movieId, @genreId);
        END
      `);
  }
}

class AdminModel {
  // --- MOVIE MANAGEMENT ---
  static async createMovie(data) {
    await ensureGenreTables();
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const result = await transaction.request()
      .input('title', sql.NVarChar, data.title || null)
      .input('description', sql.NVarChar, data.description || null)
      .input('director', sql.NVarChar, data.director || null)
      .input('duration', sql.Int, (data.duration === '' || isNaN(data.duration)) ? null : parseInt(data.duration))
      .input('ageRating', sql.VarChar, data.ageRating || null)
      .input('posterURL', sql.VarChar, data.posterURL || null)
      .input('status', sql.VarChar, data.status || 'Coming Soon')
      .input('mainCast', sql.NVarChar, data.mainCast || null)
      .input('trailerURL', sql.NVarChar, data.trailerURL || null)
      .query(`
        INSERT INTO Movies (Title, Description, Director, Duration, AgeRating, PosterURL, Status, MainCast, TrailerURL)
        OUTPUT INSERTED.*
        VALUES (@title, @description, @director, @duration, @ageRating, @posterURL, @status, @mainCast, @trailerURL)
      `);
      const movie = result.recordset[0];
      await syncMovieGenres(transaction, movie.MovieID, data.genreIds);
      await transaction.commit();
      return movie;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async updateMovie(movieId, data) {
    await ensureGenreTables();
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const result = await transaction.request()
      .input('movieId', sql.Int, movieId)
      .input('title', sql.NVarChar, data.title || null)
      .input('description', sql.NVarChar, data.description || null)
      .input('director', sql.NVarChar, data.director || null)
      .input('duration', sql.Int, (data.duration === '' || isNaN(data.duration)) ? null : parseInt(data.duration))
      .input('ageRating', sql.VarChar, data.ageRating || null)
      .input('posterURL', sql.VarChar, data.posterURL || null)
      .input('status', sql.VarChar, data.status || null)
      .input('mainCast', sql.NVarChar, data.mainCast || null)
      .input('trailerURL', sql.NVarChar, data.trailerURL !== undefined ? data.trailerURL || null : null)
      .input('keepTrailerURL', sql.Bit, data.trailerURL === undefined ? 1 : 0)
      .query(`
        UPDATE Movies
        SET Title       = COALESCE(@title, Title),
            Description = COALESCE(@description, Description),
            Director    = COALESCE(@director, Director),
            Duration    = COALESCE(@duration, Duration),
            AgeRating   = COALESCE(@ageRating, AgeRating),
            PosterURL   = COALESCE(@posterURL, PosterURL),
            Status      = COALESCE(@status, Status),
            MainCast    = COALESCE(@mainCast, MainCast),
            TrailerURL  = CASE WHEN @trailerURL IS NULL AND @keepTrailerURL = 1 THEN TrailerURL ELSE @trailerURL END
        OUTPUT INSERTED.*
        WHERE MovieID = @movieId
      `);
      const movie = result.recordset.length > 0 ? result.recordset[0] : null;
      if (movie && data.genreIds !== undefined) {
        await syncMovieGenres(transaction, movieId, data.genreIds);
      }
      await transaction.commit();
      return movie;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async deleteMovie(movieId) {
    const pool = await getPool();
    await pool.request()
      .input('movieId', sql.Int, movieId)
      .query(`UPDATE Movies SET Status = 'deleted' WHERE MovieID = @movieId`);
  }

  static async getMovieReviews({ movieId, status, rating, search } = {}) {
    await ensureMovieReviewsTable();
    const pool = await getPool();
    const request = pool.request();

    let filters = 'WHERE 1=1';
    if (movieId) {
      request.input('movieId', sql.Int, parseInt(movieId, 10));
      filters += ' AND mr.MovieID = @movieId';
    }
    if (status === 'visible') {
      filters += ' AND mr.IsVisible = 1';
    } else if (status === 'hidden') {
      filters += ' AND mr.IsVisible = 0';
    }
    if (rating) {
      request.input('rating', sql.Int, parseInt(rating, 10));
      filters += ' AND mr.Rating = @rating';
    }
    if (search) {
      request.input('search', sql.NVarChar, `%${String(search).trim()}%`);
      filters += ` AND (
        m.Title LIKE @search
        OR u.FullName LIKE @search
        OR u.Email LIKE @search
        OR mr.Comment LIKE @search
      )`;
    }

    const result = await request.query(`
      SELECT
        COUNT(*) AS TotalReviews,
        SUM(CASE WHEN mr.IsVisible = 1 THEN 1 ELSE 0 END) AS VisibleReviews,
        SUM(CASE WHEN mr.IsVisible = 0 THEN 1 ELSE 0 END) AS HiddenReviews,
        CAST(ROUND(ISNULL(AVG(CAST(CASE WHEN mr.IsVisible = 1 THEN mr.Rating END AS decimal(4,2))), 0), 1) AS decimal(3,1)) AS AverageRating
      FROM MovieReviews mr
      JOIN Movies m ON mr.MovieID = m.MovieID
      JOIN Users u ON mr.UserID = u.UserID
      ${filters};

      SELECT
        mr.ReviewID,
        mr.MovieID,
        m.Title AS MovieTitle,
        m.PosterURL,
        mr.UserID,
        COALESCE(NULLIF(u.FullName, ''), u.Email, N'Khách hàng') AS FullName,
        u.Email,
        mr.Rating,
        mr.Comment,
        mr.IsVisible,
        mr.CreatedAt,
        mr.UpdatedAt
      FROM MovieReviews mr
      JOIN Movies m ON mr.MovieID = m.MovieID
      JOIN Users u ON mr.UserID = u.UserID
      ${filters}
      ORDER BY COALESCE(mr.UpdatedAt, mr.CreatedAt) DESC, mr.ReviewID DESC;
    `);

    const summary = result.recordsets[0][0] || {};
    return {
      summary: {
        totalReviews: Number(summary.TotalReviews || 0),
        visibleReviews: Number(summary.VisibleReviews || 0),
        hiddenReviews: Number(summary.HiddenReviews || 0),
        averageRating: Number(summary.AverageRating || 0)
      },
      reviews: result.recordsets[1] || []
    };
  }

  static async toggleMovieReview(reviewId) {
    await ensureMovieReviewsTable();
    const pool = await getPool();
    const result = await pool.request()
      .input('reviewId', sql.Int, parseInt(reviewId, 10))
      .query(`
        UPDATE MovieReviews
        SET IsVisible = CASE WHEN IsVisible = 1 THEN 0 ELSE 1 END,
            UpdatedAt = GETDATE()
        OUTPUT INSERTED.ReviewID, INSERTED.MovieID, INSERTED.UserID, INSERTED.Rating,
               INSERTED.Comment, INSERTED.IsVisible, INSERTED.CreatedAt, INSERTED.UpdatedAt
        WHERE ReviewID = @reviewId;
      `);
    return result.recordset[0] || null;
  }

  static async deleteMovieReview(reviewId) {
    await ensureMovieReviewsTable();
    const pool = await getPool();
    const result = await pool.request()
      .input('reviewId', sql.Int, parseInt(reviewId, 10))
      .query(`
        DELETE FROM MovieReviews
        OUTPUT DELETED.ReviewID
        WHERE ReviewID = @reviewId;
      `);
    return result.recordset[0] || null;
  }

  static async getGenres({ includeInactive = true } = {}) {
    await ensureGenreTables();
    const pool = await getPool();
    const result = await pool.request()
      .input('includeInactive', sql.Bit, includeInactive ? 1 : 0)
      .query(`
        SELECT
          g.GenreID,
          g.GenreName,
          g.IsActive,
          COUNT(mg.MovieID) AS MovieCount
        FROM Genres g
        LEFT JOIN Movie_Genres mg ON g.GenreID = mg.GenreID
        WHERE @includeInactive = 1 OR g.IsActive = 1
        GROUP BY g.GenreID, g.GenreName, g.IsActive
        ORDER BY g.GenreName ASC
      `);
    return result.recordset;
  }

  static async createGenre(name) {
    await ensureGenreTables();
    const genreName = String(name || '').trim();
    if (!genreName) throw new Error('Vui lòng nhập tên thể loại.');
    const pool = await getPool();
    const result = await pool.request()
      .input('genreName', sql.NVarChar, genreName)
      .query(`
        IF EXISTS (SELECT 1 FROM Genres WHERE GenreName = @genreName)
        BEGIN
          UPDATE Genres SET IsActive = 1 WHERE GenreName = @genreName;
          SELECT TOP 1 GenreID, GenreName, IsActive FROM Genres WHERE GenreName = @genreName;
        END
        ELSE
        BEGIN
          INSERT INTO Genres (GenreName) OUTPUT INSERTED.GenreID, INSERTED.GenreName, INSERTED.IsActive VALUES (@genreName);
        END
      `);
    return result.recordset[0];
  }

  static async updateGenre(genreId, name) {
    await ensureGenreTables();
    const genreName = String(name || '').trim();
    if (!genreName) throw new Error('Vui lòng nhập tên thể loại.');
    const pool = await getPool();
    const result = await pool.request()
      .input('genreId', sql.Int, parseInt(genreId, 10))
      .input('genreName', sql.NVarChar, genreName)
      .query(`
        UPDATE Genres
        SET GenreName = @genreName
        OUTPUT INSERTED.GenreID, INSERTED.GenreName, INSERTED.IsActive
        WHERE GenreID = @genreId
      `);
    return result.recordset[0] || null;
  }

  static async toggleGenre(genreId) {
    await ensureGenreTables();
    const pool = await getPool();
    const result = await pool.request()
      .input('genreId', sql.Int, parseInt(genreId, 10))
      .query(`
        UPDATE Genres
        SET IsActive = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END
        OUTPUT INSERTED.GenreID, INSERTED.GenreName, INSERTED.IsActive
        WHERE GenreID = @genreId
      `);
    return result.recordset[0] || null;
  }

  static async deleteGenre(genreId) {
    await ensureGenreTables();
    const pool = await getPool();
    const result = await pool.request()
      .input('genreId', sql.Int, parseInt(genreId, 10))
      .query(`
        IF EXISTS (SELECT 1 FROM Movie_Genres WHERE GenreID = @genreId)
        BEGIN
          UPDATE Genres SET IsActive = 0 WHERE GenreID = @genreId;
          SELECT CAST(0 AS bit) AS Deleted, CAST(1 AS bit) AS Deactivated;
        END
        ELSE
        BEGIN
          DELETE FROM Genres WHERE GenreID = @genreId;
          SELECT CAST(1 AS bit) AS Deleted, CAST(0 AS bit) AS Deactivated;
        END
      `);
    return result.recordset[0];
  }

  static async getRooms() {
    await ensureRoomTypeSchema();
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT r.RoomID, r.RoomName, r.TotalSeats,
             ISNULL(r.RoomType, 'Standard') AS RoomType,
             r.CinemaID,
             c.CinemaName, c.Address
      FROM   Rooms r
      JOIN   Cinemas c ON r.CinemaID = c.CinemaID
      ORDER BY c.CinemaName, r.RoomName
    `);
    return result.recordset;
  }

  static async getSeatsByRoom(roomId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('roomId', sql.Int, roomId)
      .query(`
        SELECT s.SeatID, s.RoomID, s.SeatRow, s.SeatNumber, s.SeatType, s.PriceMultiplier,
               CASE WHEN EXISTS (
                   SELECT 1 
                   FROM Tickets t 
                   JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
                   WHERE t.SeatID = s.SeatID AND st.StartTime > GETUTCDATE()
                     AND t.Status IN ('confirmed', 'pending', 'refund_requested', 'used')
               ) THEN 1 ELSE 0 END AS IsBooked
        FROM Seats s
        WHERE s.RoomID = @roomId
        ORDER BY s.SeatRow, s.SeatNumber
      `);
    return result.recordset;
  }

  static async saveSeats(roomId, seatsArray, roomType) {
    // Validate roomType nếu được cung cấp
    if (roomType && !VALID_ROOM_TYPES.includes(roomType)) {
      throw new Error(`Loại phòng "${roomType}" không hợp lệ. Chỉ chấp nhận: ${VALID_ROOM_TYPES.join(', ')}.`);
    }
    const normalizedRoomType = roomType || 'Standard';

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);
      request.input('roomId', sql.Int, roomId);
      request.input('roomType', sql.NVarChar, normalizedRoomType);

      // 1. Get currently booked seats for this room to avoid deleting/modifying booked seats.
      const bookedSeatsResult = await request.query(`
        SELECT DISTINCT s.SeatID
        FROM Seats s
        JOIN Tickets t ON t.SeatID = s.SeatID
        JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
        WHERE s.RoomID = @roomId AND st.StartTime > GETUTCDATE()
          AND t.Status IN ('confirmed', 'pending', 'used')
      `);

      const bookedSeatIds = bookedSeatsResult.recordset.map(r => r.SeatID);

      // 2. Clear existing seats that are NOT currently booked in upcoming showtimes
      if (bookedSeatIds.length > 0) {
        await request.query(`
          DELETE FROM Seats 
          WHERE RoomID = @roomId AND SeatID NOT IN (${bookedSeatIds.join(',')})
        `);
      } else {
        await request.query(`DELETE FROM Seats WHERE RoomID = @roomId`);
      }

      // 3. Insert or update the new seats
      for (const seat of seatsArray) {
        // If seat has a SeatID and it's in the booked list, update its type/multiplier safely (or skip)
        // For simplicity, we just try to insert new seats (ones without an ID or ones that were deleted).
        // A robust logic would check if the seat exists.
        const reqSeat = new sql.Request(transaction);
        reqSeat.input('roomId', sql.Int, roomId);
        reqSeat.input('seatRow', sql.VarChar, seat.SeatRow);
        reqSeat.input('seatNumber', sql.Int, seat.SeatNumber);
        reqSeat.input('seatType', sql.VarChar, seat.SeatType);
        reqSeat.input('priceMultiplier', sql.Decimal, seat.PriceMultiplier || 1.0);

        // Use MERGE to insert or update based on Row and Number for this Room
        await reqSeat.query(`
          MERGE Seats AS target
          USING (SELECT @roomId AS RoomID, @seatRow AS SeatRow, @seatNumber AS SeatNumber) AS source
          ON (target.RoomID = source.RoomID AND target.SeatRow = source.SeatRow AND target.SeatNumber = source.SeatNumber)
          WHEN MATCHED THEN
              UPDATE SET SeatType = @seatType, PriceMultiplier = @priceMultiplier
          WHEN NOT MATCHED THEN
              INSERT (RoomID, SeatRow, SeatNumber, SeatType, PriceMultiplier)
              VALUES (@roomId, @seatRow, @seatNumber, @seatType, @priceMultiplier);
        `);
      }

      await request.query(`
        UPDATE Rooms 
        SET TotalSeats = (SELECT COUNT(*) FROM Seats WHERE RoomID = @roomId AND SeatType != 'None'),
            RoomType = @roomType
        WHERE RoomID = @roomId
      `);

      await transaction.commit();
      return true;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async getAllShowtimes({ movieId, date, cinemaId }) {
    const pool = await getPool();
    const request = pool.request();

    let filters = 'WHERE 1=1';
    if (movieId) { request.input('movieId', sql.Int, parseInt(movieId)); filters += ' AND st.MovieID = @movieId'; }
    if (date) { request.input('date', sql.Date, date); filters += ' AND CAST(DATEADD(hour, 7, st.StartTime) AS DATE) = @date'; }
    if (cinemaId) { request.input('cinemaId', sql.Int, parseInt(cinemaId)); filters += ' AND c.CinemaID = @cinemaId'; }

    const result = await request.query(`
      SELECT st.ShowtimeID, st.MovieID, st.RoomID,
             st.StartTime, st.EndTime,
             COALESCE(st.Price, st.BasePrice, 0) AS Price,
             st.Status,
             m.Title AS MovieTitle,
             r.RoomName, r.TotalSeats,
             c.CinemaName, c.CinemaID,
             COUNT(t.TicketID) AS TicketsSold
      FROM   Showtimes st
      JOIN   Movies  m ON st.MovieID = m.MovieID
      JOIN   Rooms   r ON st.RoomID  = r.RoomID
      JOIN   Cinemas c ON r.CinemaID = c.CinemaID
      LEFT   JOIN Tickets t ON t.ShowtimeID = st.ShowtimeID AND t.Status IN ('confirmed','pending')
      ${filters}
      GROUP BY st.ShowtimeID, st.MovieID, st.RoomID, st.StartTime, st.EndTime,
               COALESCE(st.Price, st.BasePrice, 0), st.Status,
               m.Title, r.RoomName, r.TotalSeats, c.CinemaName, c.CinemaID
      ORDER BY st.StartTime ASC
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
      .input('price', sql.Decimal(18, 2), data.price)
      .query(`
        INSERT INTO Showtimes (MovieID, RoomID, StartTime, EndTime, BasePrice, Status)
        OUTPUT INSERTED.*
        VALUES (@movieId, @roomId, @startTime, @endTime, @price, 'active')
      `);
    return result.recordset[0];
  }

  static async updateShowtime(showtimeId, data) {
    const pool = await getPool();

    const currentResult = await pool.request()
      .input('showtimeId', sql.Int, showtimeId)
      .query('SELECT MovieID, RoomID, StartTime, EndTime FROM Showtimes WHERE ShowtimeID = @showtimeId');

    if (currentResult.recordset.length === 0) return null;

    const current = currentResult.recordset[0];
    const movieId = data.movieId != null ? parseInt(data.movieId) : current.MovieID;
    const roomId = data.roomId != null ? parseInt(data.roomId) : current.RoomID;
    const startTime = data.startTime || current.StartTime;
    const endTime = data.endTime || current.EndTime;

    const conflictCheck = await pool.request()
      .input('roomId', sql.Int, roomId)
      .input('startTime', sql.DateTime, startTime)
      .input('endTime', sql.DateTime, endTime)
      .input('showtimeId', sql.Int, showtimeId)
      .query(`
        SELECT ShowtimeID FROM Showtimes
        WHERE RoomID = @roomId AND Status = 'active' AND ShowtimeID != @showtimeId
          AND NOT (@endTime <= StartTime OR @startTime >= EndTime)
      `);

    if (conflictCheck.recordset.length > 0) {
      throw new Error('Phòng chiếu đã có lịch trong khung giờ này.');
    }

    const result = await pool.request()
      .input('showtimeId', sql.Int, showtimeId)
      .input('movieId', sql.Int, movieId)
      .input('roomId', sql.Int, roomId)
      .input('startTime', sql.DateTime, startTime)
      .input('endTime', sql.DateTime, endTime)
      .input('price', sql.Decimal(18, 2), data.price)
      .input('status', sql.NVarChar, data.status)
      .query(`
        UPDATE Showtimes
        SET MovieID   = @movieId,
            RoomID    = @roomId,
            StartTime = @startTime,
            EndTime   = @endTime,
            BasePrice = COALESCE(@price, BasePrice),
            Status    = COALESCE(@status, Status)
        OUTPUT INSERTED.*
        WHERE ShowtimeID = @showtimeId
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async deleteShowtime(showtimeId) {
    const pool = await getPool();
    // Check if there are confirmed tickets
    const ticketCheck = await pool.request()
      .input('showtimeId', sql.Int, showtimeId)
      .query(`
        SELECT COUNT(TicketID) AS cnt FROM Tickets
        WHERE ShowtimeID = @showtimeId AND Status IN ('confirmed', 'used')
      `);
    if (ticketCheck.recordset[0].cnt > 0) {
      throw new Error('Không thể xóa suất chiếu đã có vé được bán.');
    }

    const result = await pool.request()
      .input('showtimeId', sql.Int, showtimeId)
      .query(`
        UPDATE Showtimes SET Status = 'cancelled'
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

  static async updateVoucher(id, data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('code', sql.NVarChar, data.code.toUpperCase())
      .input('discountType', sql.NVarChar, data.discountType)
      .input('discountValue', sql.Decimal, data.discountValue)
      .input('minOrderValue', sql.Decimal, data.minOrderValue || 0)
      .input('maxDiscount', sql.Decimal, data.maxDiscount || null)
      .input('usageLimit', sql.Int, data.usageLimit || null)
      .input('startDate', sql.Date, data.startDate)
      .input('endDate', sql.Date, data.endDate)
      .query(`
        UPDATE Vouchers
        SET Code = @code,
            DiscountType = @discountType,
            DiscountValue = @discountValue,
            MinOrderValue = @minOrderValue,
            MaxDiscount = @maxDiscount,
            UsageLimit = @usageLimit,
            StartDate = @startDate,
            EndDate = @endDate
        OUTPUT INSERTED.*
        WHERE VoucherID = @id
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async deleteVoucher(id) {
    const pool = await getPool();
    // Check usage in Tickets table
    const usageCheck = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT COUNT(*) as cnt FROM Tickets WHERE VoucherID = @id`);
    if (usageCheck.recordset[0].cnt > 0) {
      throw new Error('Không thể xóa voucher đã có người sử dụng.');
    }
    await pool.request()
      .input('id', sql.Int, id)
      .query(`DELETE FROM Vouchers WHERE VoucherID = @id`);
  }

  static async toggleVoucherActive(id) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE Vouchers
        SET IsActive = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END
        OUTPUT INSERTED.*
        WHERE VoucherID = @id
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }


  // --- F&B MANAGEMENT ---
  static async getFnBByNameAndCategory(name, category, excludeId = null) {
    const pool = await getPool();
    const request = pool.request()
      .input('name', sql.NVarChar, name)
      .input('category', sql.NVarChar, category);
    
    let query = `
      SELECT * FROM FoodBeverages 
      WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@name))) 
        AND Category = @category
    `;
    
    if (excludeId !== null) {
      request.input('excludeId', sql.Int, excludeId);
      query += " AND FnBID != @excludeId";
    }
    
    const result = await request.query(query);
    return result.recordset[0] || null;
  }

  static async getFnBById(id) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM FoodBeverages WHERE FnBID = @id');
    return result.recordset[0] || null;
  }

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

  static async updateFnB(id, data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, data.name)
      .input('description', sql.NVarChar, data.description || null)
      .input('category', sql.NVarChar, data.category)
      .input('price', sql.Decimal, data.price)
      .input('stock', sql.Int, data.stock)
      .input('imageURL', sql.VarChar, data.imageURL || null)
      .query(`
        UPDATE FoodBeverages
        SET Name = COALESCE(@name, Name),
            Description = COALESCE(@description, Description),
            Category = COALESCE(@category, Category),
            Price = COALESCE(@price, Price),
            Stock = COALESCE(@stock, Stock),
            ImageURL = COALESCE(@imageURL, ImageURL)
        OUTPUT INSERTED.*
        WHERE FnBID = @id
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async deleteFnB(id) {
    const pool = await getPool();
    // Delete reference records in junction tables
    await pool.request()
      .input('id', sql.Int, id)
      .query(`DELETE FROM Ticket_FnB WHERE FnBID = @id`);
    await pool.request()
      .input('id', sql.Int, id)
      .query(`DELETE FROM Booking_FnB WHERE FnBID = @id`);
    // Delete the F&B item
    await pool.request()
      .input('id', sql.Int, id)
      .query(`DELETE FROM FoodBeverages WHERE FnBID = @id`);
  }

  static async toggleFnBAvailability(id) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE FoodBeverages
        SET IsAvailable = CASE WHEN IsAvailable = 1 THEN 0 ELSE 1 END
        OUTPUT INSERTED.*
        WHERE FnBID = @id
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async getFnBStats() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM FoodBeverages) AS TotalItems,
        (SELECT COUNT(*) FROM FoodBeverages WHERE Stock < 20) AS LowStockItems,
        (SELECT ISNULL(SUM(tf.Quantity * fb.Price), 0) FROM Ticket_FnB tf JOIN FoodBeverages fb ON tf.FnBID = fb.FnBID JOIN Tickets t ON tf.TicketID = t.TicketID WHERE t.Status IN ('confirmed', 'used')) AS TotalRevenue,
        (SELECT ISNULL(SUM(tf.Quantity), 0) FROM Ticket_FnB tf JOIN Tickets t ON tf.TicketID = t.TicketID WHERE t.Status IN ('confirmed', 'used')) AS TotalVouchersUsed
    `);
    return result.recordset[0];
  }


  // --- GET ALL CINEMAS ---
  static async getCinemas() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT CinemaID, CinemaName, Address, City
      FROM Cinemas
      ORDER BY CinemaName
    `);
    return result.recordset;
  }

  // --- CREATE CINEMA ---
  static async createCinema(data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, data.name)
      .input('address', sql.NVarChar, data.address || null)
      .input('city', sql.NVarChar, data.city || null)
      .query(`
        INSERT INTO Cinemas (CinemaName, Address, City)
        OUTPUT INSERTED.*
        VALUES (@name, @address, @city)
      `);
    return result.recordset[0];
  }

  // --- UPDATE CINEMA ---
  static async updateCinema(cinemaId, data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, cinemaId)
      .input('name', sql.NVarChar, data.name)
      .input('address', sql.NVarChar, data.address || null)
      .input('city', sql.NVarChar, data.city || null)
      .query(`
        UPDATE Cinemas
        SET CinemaName = @name, Address = @address, City = @city
        WHERE CinemaID = @id;
        SELECT * FROM Cinemas WHERE CinemaID = @id;
      `);
    return result.recordset[0];
  }

  // --- DELETE CINEMA ---
  static async deleteCinema(cinemaId) {
    const pool = await getPool();
    // Check for active showtimes
    const check = await pool.request()
      .input('id', sql.Int, cinemaId)
      .query(`
        SELECT COUNT(*) AS cnt FROM Showtimes st
        JOIN Rooms r ON st.RoomID = r.RoomID
        WHERE r.CinemaID = @id AND st.Status = 'active' AND st.EndTime > GETUTCDATE()
      `);
    if (check.recordset[0].cnt > 0) {
      throw new Error('Không thể xóa rạp đang có suất chiếu hoạt động.');
    }
    // Delete seats, rooms, then cinema
    await pool.request().input('id', sql.Int, cinemaId).query(`
      DELETE FROM Seats WHERE RoomID IN (SELECT RoomID FROM Rooms WHERE CinemaID = @id);
      DELETE FROM Rooms WHERE CinemaID = @id;
      DELETE FROM Cinemas WHERE CinemaID = @id;
    `);
    return true;
  }

  // --- CREATE ROOM ---
  static async createRoom(data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('cinemaId', sql.Int, data.cinemaId)
      .input('name', sql.NVarChar, data.name)
      .input('roomType', sql.VarChar, data.roomType || 'Standard')
      .input('totalSeats', sql.Int, data.totalSeats || 0)
      .query(`
        INSERT INTO Rooms (CinemaID, RoomName, RoomType, TotalSeats)
        OUTPUT INSERTED.*
        VALUES (@cinemaId, @name, @roomType, @totalSeats)
      `);
    return result.recordset[0];
  }

  // --- UPDATE ROOM ---
  static async updateRoom(roomId, data) {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, roomId)
      .input('name', sql.NVarChar, data.name)
      .input('roomType', sql.VarChar, data.roomType || 'Standard')
      .query(`
        UPDATE Rooms SET RoomName = @name, RoomType = @roomType WHERE RoomID = @id;
        SELECT r.*, c.CinemaName FROM Rooms r JOIN Cinemas c ON r.CinemaID = c.CinemaID WHERE r.RoomID = @id;
      `);
    return result.recordset[0];
  }

  // --- DELETE ROOM ---
  static async deleteRoom(roomId) {
    const pool = await getPool();
    // Check for tickets
    const check = await pool.request()
      .input('id', sql.Int, roomId)
      .query(`
        SELECT COUNT(*) AS cnt FROM Tickets t
        JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
        WHERE st.RoomID = @id AND t.Status IN ('confirmed', 'pending')
      `);
    if (check.recordset[0].cnt > 0) {
      throw new Error('Không thể xóa phòng đang có vé bán.');
    }
    await pool.request().input('id', sql.Int, roomId).query(`
      DELETE FROM Seats WHERE RoomID = @id;
      DELETE FROM Rooms WHERE RoomID = @id;
    `);
    return true;
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

  static async getDashboardStats({ cinemaId, period } = {}) {
    const pool = await getPool();
    const request = pool.request();

    // Build date filter clause
    let dateFilter = '';
    if (period === 'today') {
      dateFilter = `AND CAST(t.BookedAt AS DATE) = CAST(GETDATE() AS DATE)`;
    } else if (period === 'week') {
      dateFilter = `AND CAST(t.BookedAt AS DATE) >= CAST(DATEADD(day, -6, GETDATE()) AS DATE)`;
    } else if (period === 'month') {
      dateFilter = `AND MONTH(t.BookedAt) = MONTH(GETDATE()) AND YEAR(t.BookedAt) = YEAR(GETDATE())`;
    }

    // Build cinema filter clause
    let cinemaJoin = '';
    let cinemaFilter = '';
    if (cinemaId) {
      request.input('cinemaId', sql.Int, parseInt(cinemaId));
      cinemaJoin = `JOIN Rooms r2 ON st2.RoomID = r2.RoomID JOIN Cinemas c2 ON r2.CinemaID = c2.CinemaID`;
      cinemaFilter = `AND c2.CinemaID = @cinemaId`;
    }

    // For seat occupancy we also need cinema scoping
    let seatCinemaJoin = cinemaId ? `JOIN Cinemas c_s ON r_s.CinemaID = c_s.CinemaID` : '';
    let seatCinemaFilter = cinemaId ? `AND c_s.CinemaID = @cinemaId` : '';

    const query = `
      DECLARE @TotalSeats INT = (
        SELECT ISNULL(SUM(r_s.TotalSeats), 1)
        FROM Showtimes st_s
        JOIN Rooms r_s ON st_s.RoomID = r_s.RoomID
        ${seatCinemaJoin}
        WHERE st_s.Status = 'active'
        ${seatCinemaFilter}
      );
      DECLARE @BookedSeats INT = (
        SELECT COUNT(DISTINCT t2.TicketID)
        FROM Tickets t2
        JOIN Showtimes st2 ON t2.ShowtimeID = st2.ShowtimeID
        ${cinemaId ? 'JOIN Rooms r2 ON st2.RoomID = r2.RoomID JOIN Cinemas c2 ON r2.CinemaID = c2.CinemaID' : ''}
        WHERE t2.Status IN ('confirmed', 'used', 'pending')
        ${cinemaId ? 'AND c2.CinemaID = @cinemaId' : ''}
        ${dateFilter.replace(/t\.BookedAt/g, 't2.BookedAt')}
      );

      SELECT
        (
          SELECT ISNULL(SUM(t.TotalAmount), 0)
          FROM Tickets t
          JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
          ${cinemaId ? 'JOIN Rooms r ON st.RoomID = r.RoomID JOIN Cinemas c ON r.CinemaID = c.CinemaID' : ''}
          WHERE t.Status IN ('confirmed', 'used')
          ${cinemaId ? 'AND c.CinemaID = @cinemaId' : ''}
          ${dateFilter}
        ) AS TotalRevenue,
        (
          SELECT COUNT(DISTINCT t.TicketID)
          FROM Tickets t
          JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
          ${cinemaId ? 'JOIN Rooms r ON st.RoomID = r.RoomID JOIN Cinemas c ON r.CinemaID = c.CinemaID' : ''}
          WHERE t.Status IN ('confirmed', 'used', 'pending')
          ${cinemaId ? 'AND c.CinemaID = @cinemaId' : ''}
          ${dateFilter}
        ) AS TicketSales,
        (
          SELECT ISNULL(SUM(tf.Quantity * fb.Price), 0)
          FROM Ticket_FnB tf
          JOIN FoodBeverages fb ON tf.FnBID = fb.FnBID
          JOIN Tickets t ON tf.TicketID = t.TicketID
          JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
          ${cinemaId ? 'JOIN Rooms r ON st.RoomID = r.RoomID JOIN Cinemas c ON r.CinemaID = c.CinemaID' : ''}
          WHERE t.Status IN ('confirmed', 'used')
          ${cinemaId ? 'AND c.CinemaID = @cinemaId' : ''}
          ${dateFilter}
        ) AS FnBSales,
        (CAST(@BookedSeats * 100.0 / NULLIF(@TotalSeats, 0) AS DECIMAL(5,1))) AS OccupancyRate
    `;
    const result = await request.query(query);
    return result.recordset[0];
  }

  static async getTopCinemaRevenueToday(limit = 5) {
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          c.CinemaID,
          c.CinemaName,
          c.City,
          COUNT(t.TicketID) AS TicketsSold,
          ISNULL(SUM(t.TotalAmount), 0) AS TotalRevenue
        FROM Tickets t
        JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
        JOIN Rooms r ON st.RoomID = r.RoomID
        JOIN Cinemas c ON r.CinemaID = c.CinemaID
        WHERE t.Status IN ('confirmed', 'used')
          AND CAST(t.BookedAt AS DATE) = CAST(GETDATE() AS DATE)
        GROUP BY c.CinemaID, c.CinemaName, c.City
        ORDER BY TotalRevenue DESC, TicketsSold DESC
      `);
    return result.recordset;
  }

  static async getLeastSoldMoviesThisWeek(limit = 5) {
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          m.MovieID,
          m.Title,
          m.Status,
          COUNT(t.TicketID) AS TicketsSold,
          ISNULL(SUM(t.TotalAmount), 0) AS TotalRevenue
        FROM Movies m
        LEFT JOIN Showtimes st ON st.MovieID = m.MovieID
        LEFT JOIN Tickets t ON t.ShowtimeID = st.ShowtimeID
          AND t.Status IN ('confirmed', 'used', 'pending')
          AND CAST(t.BookedAt AS DATE) >= CAST(DATEADD(day, -6, GETDATE()) AS DATE)
        WHERE m.Status != 'deleted'
        GROUP BY m.MovieID, m.Title, m.Status
        ORDER BY TicketsSold ASC, TotalRevenue ASC, m.Title ASC
      `);
    return result.recordset;
  }

  static async getShowtimesWithMostEmptySeats(limit = 8) {
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          st.ShowtimeID,
          m.Title AS MovieTitle,
          c.CinemaName,
          c.City,
          r.RoomName,
          r.TotalSeats,
          COUNT(t.TicketID) AS TicketsSold,
          r.TotalSeats - COUNT(t.TicketID) AS EmptySeats,
          CAST(COUNT(t.TicketID) * 100.0 / NULLIF(r.TotalSeats, 0) AS DECIMAL(5,1)) AS OccupancyRate,
          st.StartTime,
          st.EndTime,
          COALESCE(st.Price, st.BasePrice, 0) AS Price,
          st.Status
        FROM Showtimes st
        JOIN Movies m ON st.MovieID = m.MovieID
        JOIN Rooms r ON st.RoomID = r.RoomID
        JOIN Cinemas c ON r.CinemaID = c.CinemaID
        LEFT JOIN Tickets t ON t.ShowtimeID = st.ShowtimeID
          AND t.Status IN ('confirmed', 'used', 'pending')
        WHERE st.Status = 'active'
          AND st.StartTime >= DATEADD(hour, -2, GETDATE())
          AND st.StartTime < DATEADD(day, 7, GETDATE())
        GROUP BY st.ShowtimeID, m.Title, c.CinemaName, c.City, r.RoomName, r.TotalSeats,
                 st.StartTime, st.EndTime, COALESCE(st.Price, st.BasePrice, 0), st.Status
        ORDER BY EmptySeats DESC, st.StartTime ASC
      `);
    return result.recordset;
  }

  static async getTopMoviesToday(limit = 5) {
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          m.MovieID,
          m.Title,
          COUNT(t.TicketID) AS TicketsSold,
          ISNULL(SUM(t.TotalAmount), 0) AS TotalRevenue
        FROM Tickets t
        JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
        JOIN Movies m ON st.MovieID = m.MovieID
        WHERE t.Status IN ('confirmed', 'used', 'pending')
          AND CAST(t.BookedAt AS DATE) = CAST(GETDATE() AS DATE)
        GROUP BY m.MovieID, m.Title
        ORDER BY TicketsSold DESC, TotalRevenue DESC
      `);
    return result.recordset;
  }

  static async getLowOccupancyShowtimes(limit = 8) {
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          st.ShowtimeID,
          m.Title AS MovieTitle,
          c.CinemaName,
          c.City,
          r.RoomName,
          r.TotalSeats,
          COUNT(t.TicketID) AS TicketsSold,
          r.TotalSeats - COUNT(t.TicketID) AS EmptySeats,
          CAST(COUNT(t.TicketID) * 100.0 / NULLIF(r.TotalSeats, 0) AS DECIMAL(5,1)) AS OccupancyRate,
          st.StartTime,
          st.EndTime
        FROM Showtimes st
        JOIN Movies m ON st.MovieID = m.MovieID
        JOIN Rooms r ON st.RoomID = r.RoomID
        JOIN Cinemas c ON r.CinemaID = c.CinemaID
        LEFT JOIN Tickets t ON t.ShowtimeID = st.ShowtimeID
          AND t.Status IN ('confirmed', 'used', 'pending')
        WHERE st.Status = 'active'
          AND st.StartTime >= DATEADD(hour, -2, GETDATE())
          AND st.StartTime < DATEADD(day, 7, GETDATE())
        GROUP BY st.ShowtimeID, m.Title, c.CinemaName, c.City, r.RoomName, r.TotalSeats,
                 st.StartTime, st.EndTime
        ORDER BY OccupancyRate ASC, EmptySeats DESC, st.StartTime ASC
      `);
    return result.recordset;
  }

  static async getRecentTransactions(limit = 10) {
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          '#TXN-' + RIGHT('0000' + CAST(t.TicketID AS VARCHAR(10)), 4) AS id,
          c.CinemaName AS branch,
          m.Title AS item,
          FORMAT(t.BookedAt, 'dd MMM, HH:mm') AS date,
          FORMAT(t.TotalAmount, 'N0') + ' đ' AS amount,
          CASE t.Status
            WHEN 'confirmed' THEN 'COMPLETED'
            WHEN 'pending' THEN 'PENDING'
            WHEN 'cancelled' THEN 'CANCELLED'
            ELSE UPPER(t.Status)
          END AS status
        FROM Tickets t
        JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
        JOIN Movies m ON st.MovieID = m.MovieID
        JOIN Rooms r ON st.RoomID = r.RoomID
        JOIN Cinemas c ON r.CinemaID = c.CinemaID
        ORDER BY t.BookedAt DESC
      `);
    return result.recordset;
  }

  static async getMonthlyRevenue(year, cinemaId) {
    const pool = await getPool();
    const request = pool.request()
      .input('year', sql.Int, year || new Date().getFullYear());

    let cinemaJoin = '';
    let cinemaFilter = '';
    if (cinemaId) {
      request.input('cinemaId', sql.Int, parseInt(cinemaId));
      cinemaJoin = `JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID JOIN Rooms r ON st.RoomID = r.RoomID JOIN Cinemas c ON r.CinemaID = c.CinemaID`;
      cinemaFilter = `AND c.CinemaID = @cinemaId`;
    }

    let cinemaJoinFnb = '';
    let cinemaFilterFnb = '';
    if (cinemaId) {
      cinemaJoinFnb = `JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID JOIN Rooms r ON st.RoomID = r.RoomID JOIN Cinemas c ON r.CinemaID = c.CinemaID`;
      cinemaFilterFnb = `AND c.CinemaID = @cinemaId`;
    }

    const result = await request.query(`
        WITH Months AS (
            SELECT 1 AS MonthNumber UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
            UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
            UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
        )
        SELECT 
            m.MonthNumber,
            (
                SELECT ISNULL(SUM(t.TotalAmount), 0) 
                FROM Tickets t
                ${cinemaJoin}
                WHERE MONTH(t.BookedAt) = m.MonthNumber
                  AND YEAR(t.BookedAt) = @year
                  AND t.Status IN ('confirmed', 'used')
                  ${cinemaFilter}
            ) AS TicketRevenue,
            (
                SELECT ISNULL(SUM(tf.Quantity * fb.Price), 0) 
                FROM Ticket_FnB tf
                JOIN FoodBeverages fb ON tf.FnBID = fb.FnBID
                JOIN Tickets t ON tf.TicketID = t.TicketID
                ${cinemaJoinFnb}
                WHERE MONTH(t.BookedAt) = m.MonthNumber
                  AND YEAR(t.BookedAt) = @year
                  AND t.Status IN ('confirmed', 'used')
                  ${cinemaFilterFnb}
            ) AS FnBRevenue
        FROM Months m
        ORDER BY m.MonthNumber
      `);
    return result.recordset;
  }

  static async getRevenueChartData({ period, cinemaId }) {
    const pool = await getPool();
    const request = pool.request();

    let cinemaJoin = '';
    let cinemaFilter = '';
    if (cinemaId) {
      request.input('cinemaId', sql.Int, parseInt(cinemaId));
      cinemaJoin = `
        JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID 
        JOIN Rooms r ON st.RoomID = r.RoomID 
      `;
      cinemaFilter = `AND r.CinemaID = @cinemaId`;
    }

    let dateFilter = '';
    if (period === 'today') {
      dateFilter = 'CAST(t.BookedAt AS DATE) = CAST(GETDATE() AS DATE)';
    } else if (period === 'week') {
      dateFilter = 'CAST(t.BookedAt AS DATE) >= CAST(DATEADD(day, -6, GETDATE()) AS DATE)';
    } else if (period === 'month') {
      dateFilter = 'MONTH(t.BookedAt) = MONTH(GETDATE()) AND YEAR(t.BookedAt) = YEAR(GETDATE())';
    } else {
      dateFilter = 'YEAR(t.BookedAt) = YEAR(GETDATE())'; // all = this year
    }

    const result = await request.query(`
        SELECT 
            t.TicketID,
            t.TotalAmount,
            t.BookedAt,
            (
                SELECT ISNULL(SUM(tf.Quantity * fb.Price), 0)
                FROM Ticket_FnB tf
                JOIN FoodBeverages fb ON tf.FnBID = fb.FnBID
                WHERE tf.TicketID = t.TicketID
            ) AS FnBRevenue
        FROM Tickets t
        ${cinemaJoin}
        WHERE t.Status IN ('confirmed', 'used')
        AND ${dateFilter}
        ${cinemaFilter}
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
             SELECT ISNULL(SUM(t2.TotalAmount), 0) 
             FROM Tickets t2 
             JOIN Showtimes st2 ON t2.ShowtimeID = st2.ShowtimeID
             WHERE st2.MovieID = m.MovieID
               AND CAST(t2.BookedAt AS DATE) = CAST(GETDATE() AS DATE)
               AND t2.Status IN ('confirmed', 'used')
          ) AS TodayRevenue,
          COUNT(t.TicketID) AS TotalTickets
        FROM   Tickets t
        JOIN   Showtimes st ON t.ShowtimeID = st.ShowtimeID
        JOIN   Movies    m  ON st.MovieID   = m.MovieID
        WHERE  t.Status IN ('confirmed', 'used', 'pending')
        GROUP BY m.MovieID, m.Title, m.PosterURL
        ORDER BY TodayRevenue DESC, TotalTickets DESC
      `);
    return result.recordset;
  }

  static async getLiveRoomsStatus(cinemaId) {
    const pool = await getPool();
    let query = `
      SELECT 
          r.RoomID,
          r.RoomName,
          r.TotalSeats,
          c.CinemaName,
          st.ShowtimeID,
          st.StartTime,
          st.EndTime,
          m.Title AS MovieTitle,
          (
              SELECT COUNT(t.TicketID) 
              FROM Tickets t 
              WHERE t.ShowtimeID = st.ShowtimeID AND t.Status IN ('confirmed', 'used')
          ) AS TicketsSold
      FROM Rooms r
      JOIN Cinemas c ON r.CinemaID = c.CinemaID
      LEFT JOIN Showtimes st ON r.RoomID = st.RoomID 
          AND st.Status = 'active'
          AND GETUTCDATE() >= DATEADD(minute, -15, st.StartTime) 
          AND GETUTCDATE() <= DATEADD(minute, 15, st.EndTime)
      LEFT JOIN Movies m ON st.MovieID = m.MovieID
      WHERE 1=1
    `;
    const request = pool.request();
    if (cinemaId) {
      query += ` AND r.CinemaID = @cinemaId`;
      request.input('cinemaId', sql.Int, parseInt(cinemaId));
    }
    query += ` ORDER BY c.CinemaName, r.RoomName`;
    const result = await request.query(query);
    return result.recordset;
  }

  // --- PROMOTIONS MANAGEMENT ---
  static async getAllPromotions() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT PromotionID, Title, Description, BadgeLabel, ImageURL, LinkURL,
             IsFeatured, IsActive, SortOrder, CreatedAt, UpdatedAt
      FROM   Promotions
      ORDER BY SortOrder ASC, CreatedAt DESC
    `);
    return result.recordset;
  }

  static async getActivePromotions() {
    await ensurePromotionsTable();
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT PromotionID, Title, Description, BadgeLabel, ImageURL, LinkURL,
             IsFeatured, IsActive, SortOrder
      FROM   Promotions
      WHERE  IsActive = 1
      ORDER BY SortOrder ASC, CreatedAt DESC
    `);
    return result.recordset;
  }

  static async createPromotion(data) {
    await ensurePromotionsTable();
    const pool = await getPool();
    const result = await pool.request()
      .input('title', sql.NVarChar, data.title)
      .input('description', sql.NVarChar, data.description || null)
      .input('badgeLabel', sql.NVarChar, data.badgeLabel || null)
      .input('imageURL', sql.VarChar, data.imageURL || null)
      .input('linkURL', sql.VarChar, data.linkURL || null)
      .input('isFeatured', sql.Bit, data.isFeatured ? 1 : 0)
      .input('isActive', sql.Bit, data.isActive !== false ? 1 : 0)
      .input('sortOrder', sql.Int, parseInt(data.sortOrder) || 0)
      .query(`
        INSERT INTO Promotions (Title, Description, BadgeLabel, ImageURL, LinkURL, IsFeatured, IsActive, SortOrder)
        OUTPUT INSERTED.*
        VALUES (@title, @description, @badgeLabel, @imageURL, @linkURL, @isFeatured, @isActive, @sortOrder)
      `);
    return result.recordset[0];
  }

  static async updatePromotion(id, data) {
    await ensurePromotionsTable();
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('title', sql.NVarChar, data.title || null)
      .input('description', sql.NVarChar, data.description || null)
      .input('badgeLabel', sql.NVarChar, data.badgeLabel || null)
      .input('imageURL', sql.VarChar, data.imageURL || null)
      .input('linkURL', sql.VarChar, data.linkURL || null)
      .input('isFeatured', sql.Bit, data.isFeatured ? 1 : 0)
      .input('isActive', sql.Bit, data.isActive !== false ? 1 : 0)
      .input('sortOrder', sql.Int, parseInt(data.sortOrder) || 0)
      .query(`
        UPDATE Promotions
        SET Title       = COALESCE(@title,       Title),
             Description = COALESCE(@description, Description),
             BadgeLabel  = COALESCE(@badgeLabel,  BadgeLabel),
             ImageURL    = COALESCE(@imageURL,    ImageURL),
             LinkURL     = COALESCE(@linkURL,     LinkURL),
             IsFeatured  = @isFeatured,
             IsActive    = @isActive,
             SortOrder   = @sortOrder,
             UpdatedAt   = GETDATE()
        OUTPUT INSERTED.*
        WHERE PromotionID = @id
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async deletePromotion(id) {
    await ensurePromotionsTable();
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query(`DELETE FROM Promotions WHERE PromotionID = @id`);
  }

  static async togglePromotionActive(id) {
    await ensurePromotionsTable();
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE Promotions
        SET IsActive  = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END,
            UpdatedAt = GETDATE()
        OUTPUT INSERTED.*
        WHERE PromotionID = @id
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

}

module.exports = AdminModel;


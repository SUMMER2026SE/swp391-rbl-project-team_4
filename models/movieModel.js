const { sql, getPool } = require('../config/db');
let reviewSchemaReady = false;

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

async function ensureReviewTable() {
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
             (SELECT STRING_AGG(CAST(mg.GenreID AS varchar(20)), ',')
              FROM Movie_Genres mg
              WHERE mg.MovieID = m.MovieID) AS GenreIDs,
             COALESCE((SELECT STRING_AGG(Format, ', ')
                       FROM (SELECT DISTINCT CASE
                               WHEN r2.RoomName LIKE '%3D%' THEN '3D'
                               WHEN r2.RoomName LIKE '%IMAX%' THEN 'IMAX'
                               ELSE '2D Standard'
                             END AS Format
                             FROM Showtimes st2
                             JOIN Rooms r2 ON st2.RoomID = r2.RoomID
                             WHERE st2.MovieID = m.MovieID AND st2.Status = 'active') AS Formats), 'Standard') AS Formats
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
            WHERE st.MovieID = m.MovieID AND c.City = @city AND st.StartTime > GETUTCDATE() AND st.Status = 'active'
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
             (SELECT STRING_AGG(CAST(mg.GenreID AS varchar(20)), ',')
              FROM Movie_Genres mg
              WHERE mg.MovieID = m.MovieID) AS GenreIDs,
             COALESCE((SELECT STRING_AGG(Format, ', ')
                       FROM (SELECT DISTINCT CASE
                               WHEN r.RoomName LIKE '%3D%' THEN '3D'
                               WHEN r.RoomName LIKE '%IMAX%' THEN 'IMAX'
                               ELSE '2D Standard'
                             END AS Format
                             FROM Showtimes st
                             JOIN Rooms r ON st.RoomID = r.RoomID
                             WHERE st.MovieID = m.MovieID AND st.Status = 'active') AS Formats), 'Standard') AS Formats
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
             (SELECT STRING_AGG(CAST(mg.GenreID AS varchar(20)), ',')
              FROM Movie_Genres mg
              WHERE mg.MovieID = m.MovieID) AS GenreIDs,
             COALESCE((SELECT STRING_AGG(Format, ', ')
                       FROM (SELECT DISTINCT CASE
                               WHEN r.RoomName LIKE '%3D%' THEN '3D'
                               WHEN r.RoomName LIKE '%IMAX%' THEN 'IMAX'
                               ELSE '2D Standard'
                             END AS Format
                             FROM Showtimes st
                             JOIN Rooms r ON st.RoomID = r.RoomID
                             WHERE st.MovieID = m.MovieID AND st.Status = 'active') AS Formats), 'Standard') AS Formats
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
               (SELECT STRING_AGG(CAST(mg.GenreID AS varchar(20)), ',')
                FROM Movie_Genres mg
                WHERE mg.MovieID = m.MovieID) AS GenreIDs,
               COALESCE((SELECT STRING_AGG(Format, ', ')
                         FROM (SELECT DISTINCT CASE
                                 WHEN r.RoomName LIKE '%3D%' THEN '3D'
                                 WHEN r.RoomName LIKE '%IMAX%' THEN 'IMAX'
                                 ELSE '2D Standard'
                               END AS Format
                               FROM Showtimes st
                               JOIN Rooms r ON st.RoomID = r.RoomID
                               WHERE st.MovieID = m.MovieID AND st.Status = 'active') AS Formats), 'Standard') AS Formats
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
      SELECT st.ShowtimeID,
             CONVERT(varchar(19), st.StartTime, 126) AS StartTime,
             CONVERT(varchar(19), st.EndTime, 126) AS EndTime,
             COALESCE(st.Price, st.BasePrice, 0) AS Price, st.Status,
             r.RoomID, r.RoomName, r.TotalSeats,
             CASE
               WHEN r.RoomName LIKE '%3D%' THEN '3D'
               WHEN r.RoomName LIKE '%IMAX%' THEN 'IMAX'
               ELSE '2D Standard'
             END AS RoomType,
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
                              AND t.Status IN ('confirmed', 'pending', 'refund_requested')
        WHERE  st.ShowtimeID = @showtimeId
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
        SELECT st.ShowtimeID,
               CONVERT(varchar(19), st.StartTime, 126) AS StartTime,
               CONVERT(varchar(19), st.EndTime, 126) AS EndTime,
               COALESCE(st.Price, st.BasePrice, 0) AS Price, st.Status,
               r.RoomID, r.RoomName, r.TotalSeats,
               CASE
                 WHEN r.RoomName LIKE '%3D%' THEN '3D'
                 WHEN r.RoomName LIKE '%IMAX%' THEN 'IMAX'
                 ELSE '2D Standard'
               END AS RoomType,
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
      SELECT st.ShowtimeID,
             CONVERT(varchar(19), st.StartTime, 126) AS StartTime,
             CONVERT(varchar(19), st.EndTime, 126) AS EndTime,
             COALESCE(st.Price, st.BasePrice, 0) AS Price, st.Status,
             r.RoomID, r.RoomName, r.TotalSeats,
             CASE
               WHEN r.RoomName LIKE '%3D%' THEN '3D'
               WHEN r.RoomName LIKE '%IMAX%' THEN 'IMAX'
               ELSE '2D Standard'
             END AS RoomType,
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
                    AND tk.Status IN ('confirmed', 'pending', 'refund_requested')
                )
             ) AS AvailableSeats,
             (SELECT COUNT(*)
              FROM Tickets tk
              WHERE tk.ShowtimeID = st.ShowtimeID AND tk.Status IN ('confirmed', 'pending', 'refund_requested')
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

  static async getMovieReviews(movieId) {
    await ensureReviewTable();

    const pool = await getPool();
    const result = await pool.request()
      .input('movieId', sql.Int, parseInt(movieId))
      .query(`
        SELECT
          CAST(ROUND(ISNULL(AVG(CAST(Rating AS decimal(4,2))), 0), 1) AS decimal(3,1)) AS AverageRating,
          COUNT(*) AS ReviewCount
        FROM MovieReviews
        WHERE MovieID = @movieId AND IsVisible = 1;

        SELECT TOP 20
          mr.ReviewID,
          mr.MovieID,
          mr.UserID,
          COALESCE(NULLIF(u.FullName, ''), 'Khach hang') AS FullName,
          mr.Rating,
          mr.Comment,
          mr.CreatedAt,
          mr.UpdatedAt
        FROM MovieReviews mr
        JOIN Users u ON mr.UserID = u.UserID
        WHERE mr.MovieID = @movieId AND mr.IsVisible = 1
        ORDER BY COALESCE(mr.UpdatedAt, mr.CreatedAt) DESC;
      `);

    const summary = result.recordsets[0][0] || { AverageRating: 0, ReviewCount: 0 };
    return {
      summary: {
        averageRating: Number(summary.AverageRating || 0),
        reviewCount: Number(summary.ReviewCount || 0),
      },
      reviews: result.recordsets[1] || [],
    };
  }

  static async getMyMovieReview(movieId, userId) {
    await ensureReviewTable();

    const pool = await getPool();
    const result = await pool.request()
      .input('movieId', sql.Int, parseInt(movieId))
      .input('userId', sql.Int, parseInt(userId))
      .query(`
        SELECT CASE WHEN EXISTS (
          SELECT 1
          FROM Tickets t
          JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
          WHERE t.UserID = @userId
            AND st.MovieID = @movieId
            AND t.Status IN ('confirmed', 'used')
        ) THEN 1 ELSE 0 END AS CanReview;

        SELECT TOP 1
          ReviewID, MovieID, UserID, Rating, Comment, CreatedAt, UpdatedAt
        FROM MovieReviews
        WHERE MovieID = @movieId AND UserID = @userId;
      `);

    return {
      canReview: Boolean(result.recordsets[0][0]?.CanReview),
      review: result.recordsets[1][0] || null,
    };
  }

  static async saveMovieReview(movieId, userId, { rating, comment }) {
    await ensureReviewTable();

    const parsedMovieId = parseInt(movieId);
    const parsedUserId = parseInt(userId);
    const parsedRating = parseInt(rating);
    const cleanComment = String(comment || '').trim();

    if (!Number.isInteger(parsedMovieId) || parsedMovieId <= 0) {
      const err = new Error('MovieID khong hop le.');
      err.code = 'INVALID_MOVIE';
      throw err;
    }
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      const err = new Error('Rating phai tu 1 den 5.');
      err.code = 'INVALID_RATING';
      throw err;
    }
    if (cleanComment.length > 1000) {
      const err = new Error('Noi dung danh gia toi da 1000 ky tu.');
      err.code = 'COMMENT_TOO_LONG';
      throw err;
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('movieId', sql.Int, parsedMovieId)
      .input('userId', sql.Int, parsedUserId)
      .input('rating', sql.Int, parsedRating)
      .input('comment', sql.NVarChar(1000), cleanComment || null)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM Movies WHERE MovieID = @movieId AND Status != 'deleted')
        BEGIN
          THROW 51001, 'MOVIE_NOT_FOUND', 1;
        END;

        IF NOT EXISTS (
          SELECT 1
          FROM Tickets t
          JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
          WHERE t.UserID = @userId
            AND st.MovieID = @movieId
            AND t.Status IN ('confirmed', 'used')
        )
        BEGIN
          THROW 51002, 'TICKET_REQUIRED', 1;
        END;

        IF EXISTS (SELECT 1 FROM MovieReviews WHERE MovieID = @movieId AND UserID = @userId)
        BEGIN
          UPDATE MovieReviews
          SET Rating = @rating,
              Comment = @comment,
              IsVisible = 1,
              UpdatedAt = GETDATE()
          WHERE MovieID = @movieId AND UserID = @userId;
        END
        ELSE
        BEGIN
          INSERT INTO MovieReviews (MovieID, UserID, Rating, Comment)
          VALUES (@movieId, @userId, @rating, @comment);
        END;

        SELECT TOP 1
          ReviewID, MovieID, UserID, Rating, Comment, CreatedAt, UpdatedAt
        FROM MovieReviews
        WHERE MovieID = @movieId AND UserID = @userId;
      `);

    return result.recordset[0];
  }
}

module.exports = MovieModel;

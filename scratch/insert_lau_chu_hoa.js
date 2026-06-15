const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    console.log('[Migration] Connected to database.');

    // 1. Ensure "Kinh dị" genre exists
    let kinhDiId;
    const genreKinhDiCheck = await pool.request()
      .input('genreName', 'Kinh dị')
      .query('SELECT GenreID FROM Genres WHERE GenreName = @genreName');
    
    if (genreKinhDiCheck.recordset.length > 0) {
      kinhDiId = genreKinhDiCheck.recordset[0].GenreID;
      console.log(`[Migration] Genre "Kinh dị" exists with ID: ${kinhDiId}`);
    } else {
      const genreInsert = await pool.request()
        .input('genreName', 'Kinh dị')
        .query('INSERT INTO Genres (GenreName) OUTPUT INSERTED.GenreID VALUES (@genreName)');
      kinhDiId = genreInsert.recordset[0].GenreID;
      console.log(`[Migration] Inserted genre "Kinh dị" with ID: ${kinhDiId}`);
    }

    // 2. Ensure "Ly Kì" genre exists
    let lyKiId;
    const genreLyKiCheck = await pool.request()
      .input('genreName', 'Ly Kì')
      .query('SELECT GenreID FROM Genres WHERE GenreName = @genreName');
    
    if (genreLyKiCheck.recordset.length > 0) {
      lyKiId = genreLyKiCheck.recordset[0].GenreID;
      console.log(`[Migration] Genre "Ly Kì" exists with ID: ${lyKiId}`);
    } else {
      const genreInsert = await pool.request()
        .input('genreName', 'Ly Kì')
        .query('INSERT INTO Genres (GenreName) OUTPUT INSERTED.GenreID VALUES (@genreName)');
      lyKiId = genreInsert.recordset[0].GenreID;
      console.log(`[Migration] Inserted genre "Ly Kì" with ID: ${lyKiId}`);
    }

    // 3. Ensure Movie exists
    const title = 'Lầu Chú Hỏa';
    const desc = 'Để câu view, một nhóm streamer livestream khám phá Lầu Chú Hỏa, dinh thự bỏ hoang gắn với truyền thuyết về con ma nhà họ Hứa. Nhưng ngay từ những phút đầu, mọi thứ đã vượt khỏi tầm kiểm soát. Hiện tượng siêu nhiên liên tiếp xảy ra, kéo cả nhóm vào vòng xoáy ám ảnh không lối thoát. Buổi livestream nhanh chóng biến thành nơi “tạo nghiệp – trả nghiệp”, khi từng người phải trả giá cho lòng tham và sự báng bổ trước linh hồn oan khuất của cô tiểu thư họ Hứa.';
    const director = 'Hùng Trấn';
    const duration = 94;
    const ageRating = 'T18';
    const trailer = 'https://www.youtube.com/watch?v=iYH9lUytbmA';
    const poster = 'images/movie_lau_chu_hoa.png';
    const status = 'Now Showing';
    const mainCast = 'Trần Kỳ Anh, Nguyễn Minh Thời, Ngọc Chí Bảo';

    let movieId;
    const movieCheck = await pool.request()
      .input('title', title)
      .query('SELECT MovieID FROM Movies WHERE Title = @title');

    if (movieCheck.recordset.length > 0) {
      movieId = movieCheck.recordset[0].MovieID;
      console.log(`[Migration] Movie "Lầu Chú Hỏa" already exists with ID: ${movieId}. Updating...`);
      await pool.request()
        .input('movieId', movieId)
        .input('desc', desc)
        .input('director', director)
        .input('duration', duration)
        .input('ageRating', ageRating)
        .input('trailer', trailer)
        .input('poster', poster)
        .input('status', status)
        .input('mainCast', mainCast)
        .query(`
          UPDATE Movies
          SET Description = @desc,
              Director = @director,
              Duration = @duration,
              AgeRating = @ageRating,
              TrailerURL = @trailer,
              PosterURL = @poster,
              Status = @status,
              MainCast = @mainCast
          WHERE MovieID = @movieId
        `);
    } else {
      const movieInsert = await pool.request()
        .input('title', title)
        .input('desc', desc)
        .input('director', director)
        .input('duration', duration)
        .input('ageRating', ageRating)
        .input('trailer', trailer)
        .input('poster', poster)
        .input('status', status)
        .input('mainCast', mainCast)
        .query(`
          INSERT INTO Movies (Title, Description, Director, Duration, AgeRating, TrailerURL, PosterURL, Status, MainCast)
          OUTPUT INSERTED.MovieID
          VALUES (@title, @desc, @director, @duration, @ageRating, @trailer, @poster, @status, @mainCast)
        `);
      movieId = movieInsert.recordset[0].MovieID;
      console.log(`[Migration] Inserted movie "Lầu Chú Hỏa" with ID: ${movieId}`);
    }

    // 4. Ensure Movie Genre relations exist
    for (const genreId of [kinhDiId, lyKiId]) {
      const relationCheck = await pool.request()
        .input('movieId', movieId)
        .input('genreId', genreId)
        .query('SELECT 1 FROM Movie_Genres WHERE MovieID = @movieId AND GenreID = @genreId');
      
      if (relationCheck.recordset.length === 0) {
        await pool.request()
          .input('movieId', movieId)
          .input('genreId', genreId)
          .query('INSERT INTO Movie_Genres (MovieID, GenreID) VALUES (@movieId, @genreId)');
        console.log(`[Migration] Mapped movie ${movieId} to genre ${genreId}`);
      } else {
        console.log(`[Migration] Movie-Genre mapping already exists for genre ${genreId}.`);
      }
    }

    // 5. Ensure Showtimes exist
    const showtimeCheck = await pool.request()
      .input('movieId', movieId)
      .query('SELECT COUNT(*) as count FROM Showtimes WHERE MovieID = @movieId');
    
    if (showtimeCheck.recordset[0].count === 0) {
      await pool.request()
        .input('movieId', movieId)
        .query(`
          DECLARE @Today DATE = GETDATE();
          INSERT INTO Showtimes (MovieID, RoomID, StartTime, EndTime, BasePrice, Status) VALUES
          -- Today 14:30 - 16:04 (870m - 964m)
          (@movieId, 1, DATEADD(minute, 870, CAST(@Today AS DATETIME)), DATEADD(minute, 964, CAST(@Today AS DATETIME)), 90000, 'active'),
          -- Today 19:00 - 20:34 (1140m - 1234m)
          (@movieId, 2, DATEADD(minute, 1140, CAST(@Today AS DATETIME)), DATEADD(minute, 1234, CAST(@Today AS DATETIME)), 120000, 'active'),
          -- Tomorrow 10:00 - 11:34 (2040m - 2134m)
          (@movieId, 1, DATEADD(minute, 2040, CAST(@Today AS DATETIME)), DATEADD(minute, 2134, CAST(@Today AS DATETIME)), 85000, 'active');
        `);
      console.log(`[Migration] Showtimes inserted successfully.`);
    } else {
      console.log(`[Migration] Showtimes already exist.`);
    }

    // 6. Insert reviews/ratings if needed to simulate the 8.2 rating (166 votes)
    // Wait, let's see if there are any reviews for this movie
    const reviewCheck = await pool.request()
      .input('movieId', movieId)
      .query('SELECT COUNT(*) as count FROM Reviews WHERE MovieID = @movieId');
    
    if (reviewCheck.recordset[0].count === 0) {
      // Let's insert a couple of reviews to give it some content in the reviews section
      // Get some user IDs first
      const usersRes = await pool.request().query('SELECT TOP 3 UserID FROM Users');
      const users = usersRes.recordset;
      if (users.length > 0) {
        // User 1 review
        await pool.request()
          .input('userId', users[0].UserID)
          .input('movieId', movieId)
          .query(`
            INSERT INTO Reviews (UserID, MovieID, Rating, Comment) VALUES
            (@userId, @movieId, 9, N'Phim xem siêu hồi hộp và đáng sợ! Bối cảnh dinh thự rất chân thật.')
          `);
      }
      if (users.length > 1) {
        // User 2 review
        await pool.request()
          .input('userId', users[1].UserID)
          .input('movieId', movieId)
          .query(`
            INSERT INTO Reviews (UserID, MovieID, Rating, Comment) VALUES
            (@userId, @movieId, 8, N'Lâu rồi mới xem được một bộ phim kinh dị Việt Nam chất lượng như vậy.')
          `);
      }
      console.log(`[Migration] Simulated reviews inserted.`);
    }

    console.log('[Migration] ✅ Movie "Lầu Chú Hỏa" insertion complete!');
    process.exit(0);
  } catch (err) {
    console.error('[Migration] ❌ Insertion failed:', err);
    process.exit(1);
  }
}

main();

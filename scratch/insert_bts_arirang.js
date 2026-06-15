const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    console.log('[Migration] Connected to database.');

    // 1. Ensure "Ca Nhạc" genre exists
    let genreId;
    const genreCheck = await pool.request()
      .input('genreName', 'Ca Nhạc')
      .query('SELECT GenreID FROM Genres WHERE GenreName = @genreName');
    
    if (genreCheck.recordset.length > 0) {
      genreId = genreCheck.recordset[0].GenreID;
      console.log(`[Migration] Genre "Ca Nhạc" already exists with ID: ${genreId}`);
    } else {
      const genreInsert = await pool.request()
        .input('genreName', 'Ca Nhạc')
        .query('INSERT INTO Genres (GenreName) OUTPUT INSERTED.GenreID VALUES (@genreName)');
      genreId = genreInsert.recordset[0].GenreID;
      console.log(`[Migration] Inserted genre "Ca Nhạc" with ID: ${genreId}`);
    }

    // 2. Ensure Movie exists
    const title = "BTS World Tour 'Arirang' In Busan: Live Viewing";
    const desc = `Hành trình lịch sử tiếp tục được viết nên. Sau màn khởi động phá vỡ mọi kỷ lục của World Tour “ARIRANG”, những biểu tượng nhạc pop BTS sẽ trở lại sân vận động Busan Asiad Main Stadium trong một đêm concert mang ý nghĩa đặc biệt, được truyền hình trực tiếp đến các rạp chiếu phim trên toàn thế giới. Đây cũng là lần trở lại đầy xúc động tại chính địa điểm mà nhóm đã có sân khấu biểu diễn đầy đủ thành viên cuối cùng trước thời gian nhập ngũ cách đây 3 năm 8 tháng.

Đi qua 34 thành phố với 85 đêm diễn, tour diễn này thiết lập cột mốc mới khi trở thành chuyến lưu diễn quy mô lớn nhất từng được thực hiện bởi một nghệ sĩ Hàn Quốc. Đặc biệt hơn, concert diễn ra vào ngày 13 tháng 6 — ngày kỷ niệm debut của BTS — càng khiến sự kiện mang thêm ý nghĩa sâu sắc khi nhóm nhìn lại loạt thành tựu đã cùng nhau tạo dựng và hướng tới tương lai phía trước.

Mang tên “ARIRANG”, tour diễn đồng hành cùng album phòng thu thứ năm của BTS, đan xen những góc nhìn nội tâm chân thật cùng các chủ đề phổ quát về nỗi nhớ và tình yêu sâu đậm — những yếu tố làm nên bản sắc riêng của nhóm. Với thiết kế sân khấu 360 độ đặc trưng đầy choáng ngợp, concert mang đến trải nghiệm nhập vai, đưa khán giả trở thành một phần trong khoảnh khắc lễ hội ấy.

Cùng nhau hòa mình vào những khoảnh khắc bùng nổ trong màn tái xuất mang tính biểu tượng của BTS trên màn ảnh rộng toàn cầu — với 2 sự kiện cực đại: Ngày 13/6 và 14/6 được PHÁT TRỰC TIẾP TỪ BUSAN.

Phim mới BTS WORLD TOUR ‘ARIRANG’ IN BUSAN: LIVE VIEWING có suất chiếu LIVE - Phát Sóng Trực Tiếp vào 16:45 ngày 13.06 và REBROADCAST - Phát Lại vào 16:45 ngày 14.06.2026 tại các rạp chiếu phim toàn quốc.`;

    let movieId;
    const movieCheck = await pool.request()
      .input('title', title)
      .query('SELECT MovieID FROM Movies WHERE Title = @title');

    if (movieCheck.recordset.length > 0) {
      movieId = movieCheck.recordset[0].MovieID;
      console.log(`[Migration] Movie already exists with ID: ${movieId}. Updating...`);
      await pool.request()
        .input('movieId', movieId)
        .input('desc', desc)
        .input('director', 'Đang cập nhật')
        .input('duration', 0)
        .input('ageRating', 'P')
        .input('trailer', 'https://www.youtube.com/watch?v=3DxPbeFtoDI&t=1s')
        .input('poster', 'images/movie_bts_arirang.png')
        .input('status', 'Now Showing')
        .input('mainCast', 'BTS')
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
        .input('director', 'Đang cập nhật')
        .input('duration', 0)
        .input('ageRating', 'P')
        .input('trailer', 'https://www.youtube.com/watch?v=3DxPbeFtoDI&t=1s')
        .input('poster', 'images/movie_bts_arirang.png')
        .input('status', 'Now Showing')
        .input('mainCast', 'BTS')
        .query(`
          INSERT INTO Movies (Title, Description, Director, Duration, AgeRating, TrailerURL, PosterURL, Status, MainCast)
          OUTPUT INSERTED.MovieID
          VALUES (@title, @desc, @director, @duration, @ageRating, @trailer, @poster, @status, @mainCast)
        `);
      movieId = movieInsert.recordset[0].MovieID;
      console.log(`[Migration] Inserted movie with ID: ${movieId}`);
    }

    // 3. Ensure Genre relation exists
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
      console.log(`[Migration] Movie-Genre mapping already exists.`);
    }

    // 4. Ensure Showtimes exist
    // Check if showtimes already exist for this movie
    const showtimeCheck = await pool.request()
      .input('movieId', movieId)
      .query('SELECT COUNT(*) as count FROM Showtimes WHERE MovieID = @movieId');
    
    if (showtimeCheck.recordset[0].count === 0) {
      // Create showtimes for today at 16:45 and tomorrow at 16:45
      // 16:45 is 1005 minutes. Duration is 0. EndTime = StartTime
      await pool.request()
        .input('movieId', movieId)
        .query(`
          DECLARE @Today DATE = GETDATE();
          INSERT INTO Showtimes (MovieID, RoomID, StartTime, EndTime, BasePrice, Status) VALUES
          (@movieId, 1, DATEADD(minute, 1005, CAST(@Today AS DATETIME)), DATEADD(minute, 1005, CAST(@Today AS DATETIME)), 120000, 'active'),
          (@movieId, 1, DATEADD(minute, 2445, CAST(@Today AS DATETIME)), DATEADD(minute, 2445, CAST(@Today AS DATETIME)), 120000, 'active');
        `);
      console.log(`[Migration] Showtimes inserted successfully.`);
    } else {
      console.log(`[Migration] Showtimes already exist.`);
    }

    console.log('[Migration] ✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('[Migration] ❌ Migration failed:', err);
    process.exit(1);
  }
}

main();

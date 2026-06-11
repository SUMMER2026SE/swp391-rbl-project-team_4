const { getPool } = require('../config/db');

(async () => {
  try {
    const pool = await getPool();
    console.log("Connected to DB, inserting John Wick: Chapter 4...");

    // Insert movie and return the generated MovieID
    const result = await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM Movies WHERE Title = N'John Wick: Chapter 4')
      BEGIN
        INSERT INTO Movies (Title, Description, Director, Duration, AgeRating, TrailerURL, PosterURL, Status, MainCast, Genre)
        OUTPUT INSERTED.MovieID
        VALUES (
          N'John Wick: Chapter 4',
          N'John Wick tìm ra con đường đánh bại Hội Đồng Tối Cao. Nhưng trước khi có thể giành lại tự do, Wick phải đối đầu với một kẻ thù mới với những liên minh hùng mạnh trên toàn cầu và những người bạn cũ nay đã hóa kẻ thù.',
          N'Chad Stahelski',
          169,
          'T18',
          'https://www.youtube.com/embed/qEVUardpmfg',
          'images/movie_neon_dreams.png',
          'Now Showing',
          N'Keanu Reeves, Donnie Yen, Bill Skarsgård',
          N'Hành động, Giật gân'
        );
      END
      ELSE
      BEGIN
        SELECT MovieID FROM Movies WHERE Title = N'John Wick: Chapter 4';
      END
    `);

    const movieId = result.recordset[0].MovieID;
    console.log("Movie ID resolved:", movieId);

    // Insert junction table link to Action genre (GenreID: 1)
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM Movie_Genres WHERE MovieID = ${movieId} AND GenreID = 1)
      BEGIN
        INSERT INTO Movie_Genres (MovieID, GenreID) VALUES (${movieId}, 1);
        PRINT 'Linked John Wick: Chapter 4 to Action genre successfully.';
      END
    `);

    console.log("Completed John Wick: Chapter 4 insertion!");
  } catch (err) {
    console.error("Failed to insert movie:", err);
  } finally {
    process.exit(0);
  }
})();

require('dotenv').config();
const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();

    // Insert the movie 'PAW Patrol: Phim Khủng Long'
    console.log('Inserting movie PAW Patrol: Phim Khủng Long...');
    const movieResult = await pool.request().query(`
      INSERT INTO Movies (Title, Description, Director, Duration, AgeRating, TrailerURL, PosterURL, Status, MainCast)
      OUTPUT INSERTED.MovieID
      VALUES (
        N'PAW Patrol: Phim Khủng Long',
        N'Khi con tàu của PAW Patrol bị cuốn vào một cơn bão bí ẩn, đội cún cứu hộ vô tình lưu lạc đến một hòn đảo nhiệt đới vô danh, nơi sinh sống của nhiều loài khủng long cổ xưa. Họ gặp Rex, một chuyên gia về khủng long, đã mắc kẹt trên hòn đảo này trong nhiều năm. Mọi chuyện trở nên tệ hơn khi Thị trưởng Humdinger, đối thủ không đội trời chung của PAW Patrol rắp tâm khai thác nguồn tài nguyên thiên nhiên tại đây, và vô tình gây ra trận phun trào của một ngọn núi lửa khổng lồ. Đứng trước nguy cơ hòn đảo bị xóa sổ, đội cún cứu hộ phải thực hiện những nhiệm vụ quy mô "khủng" hơn bao giờ hết để ngăn chặn Humdinger và cứu các loài khủng long khỏi nạn tuyệt chủng.',
        N'Cal Brunker',
        0,
        'P',
        'https://www.youtube.com/watch?v=y7VKkbcz658',
        'images/movie_pawpatrol_dino.png',
        'Coming Soon',
        N'Mckenna Grace, Carter Young, Paris Hilton'
      );
    `);
    
    const movieId = movieResult.recordset[0].MovieID;
    console.log('Movie ID:', movieId);

    // Get Genre IDs for 'Hoạt hình', 'Hài', 'Hành động'
    const g1 = await pool.request().query("SELECT GenreID FROM Genres WHERE GenreName = N'Hoạt hình'");
    const g2 = await pool.request().query("SELECT GenreID FROM Genres WHERE GenreName = N'Hài'");
    const g3 = await pool.request().query("SELECT GenreID FROM Genres WHERE GenreName = N'Hành động'");
    const id1 = g1.recordset[0].GenreID;
    const id2 = g2.recordset[0].GenreID;
    const id3 = g3.recordset[0].GenreID;

    // Insert genre associations
    console.log('Adding genre mappings...');
    await pool.request().query(`
      INSERT INTO Movie_Genres (MovieID, GenreID)
      VALUES (${movieId}, ${id1}), (${movieId}, ${id2}), (${movieId}, ${id3});
    `);

    console.log('Successfully inserted movie and genre mappings.');
    process.exit(0);
  } catch (err) {
    console.error('Error inserting movie:', err);
    process.exit(1);
  }
}

main();

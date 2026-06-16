require('dotenv').config();
const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();

    // 1. Insert 'Giật Gân' genre if it does not exist
    console.log('Ensuring genre Giật Gân exists...');
    await pool.request().query("IF NOT EXISTS (SELECT 1 FROM Genres WHERE GenreName = N'Giật Gân') INSERT INTO Genres (GenreName) VALUES (N'Giật Gân');");

    // 2. Insert the movie 'Ám Ảnh'
    console.log('Inserting movie Ám Ảnh...');
    const movieResult = await pool.request().query(`
      INSERT INTO Movies (Title, Description, Director, Duration, AgeRating, TrailerURL, PosterURL, Status, MainCast)
      OUTPUT INSERTED.MovieID
      VALUES (
        N'Ám Ảnh',
        N'Bear, một chàng trai si tình, đã bẻ gãy món đồ chơi bí ẩn mang tên "Liễu Ước Nguyện" để đổi lấy tình yêu của cô gái mình thầm thương. Điều ước nhanh chóng trở thành hiện thực, nhưng hạnh phúc mà anh hằng mong đợi lại dần biến thành cơn ác mộng. Bear dần nhận ra một sự thật rùng rợn: cái giá phải trả cho món quà kỳ diệu đó kinh hoàng và đen tối hơn bất cứ điều gì anh có thể tưởng tượng.',
        N'Curry Barker',
        109,
        'T18',
        'https://www.youtube.com/watch?v=rZF4vNv36Dw',
        'images/movie_amanh.png',
        'Coming Soon',
        N'Michael Johnston, Inde Navarrete, Cooper Tomlinson'
      );
    `);
    
    const movieId = movieResult.recordset[0].MovieID;
    console.log('Movie ID:', movieId);

    // 3. Get Genre IDs for 'Kinh dị' and 'Giật Gân'
    const g1 = await pool.request().query("SELECT GenreID FROM Genres WHERE GenreName = N'Kinh dị'");
    const g2 = await pool.request().query("SELECT GenreID FROM Genres WHERE GenreName = N'Giật Gân'");
    const id1 = g1.recordset[0].GenreID;
    const id2 = g2.recordset[0].GenreID;

    // 4. Insert genre associations
    console.log('Adding genre mappings...');
    await pool.request().query(`
      INSERT INTO Movie_Genres (MovieID, GenreID)
      VALUES (${movieId}, ${id1}), (${movieId}, ${id2});
    `);

    console.log('Successfully inserted movie and genre mappings.');
    process.exit(0);
  } catch (err) {
    console.error('Error inserting movie:', err);
    process.exit(1);
  }
}

main();

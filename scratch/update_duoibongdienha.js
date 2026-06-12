const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    
    // Update the movie "Dưới Bóng Điện Hạ" details in the database
    const result = await pool.request()
      .input('title', 'Dưới Bóng Điện Hạ')
      .input('poster', 'images/movie_duoibongdienha.png')
      .input('trailer', 'https://www.youtube.com/watch?v=aPsEOR-WK6U')
      .query(`
        UPDATE Movies
        SET PosterURL = @poster, TrailerURL = @trailer
        OUTPUT INSERTED.*
        WHERE Title = @title
      `);

    console.log('--- UPDATED MOVIE RECORD IN DATABASE ---');
    console.log(JSON.stringify(result.recordset, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error updating Dưới Bóng Điện Hạ in database:', err);
    process.exit(1);
  }
}

main();

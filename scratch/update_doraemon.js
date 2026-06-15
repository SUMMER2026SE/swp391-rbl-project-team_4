const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    
    // Update the movie "Doraemon Movie 45 (2026): Nobita Và Lâu Đài Dưới Đáy Biển" details in the database
    const result = await pool.request()
      .input('title', 'Doraemon Movie 45 (2026): Nobita Và Lâu Đài Dưới Đáy Biển')
      .input('poster', 'images/doraemon_sea.png')
      .input('trailer', 'https://www.youtube.com/watch?v=u3JgYkmuK78&t=1s')
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
    console.error('Error updating Doraemon in database:', err);
    process.exit(1);
  }
}

main();

const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    
    // Update the movie "Siêu Quậy Marsupilami" details in the database
    const result = await pool.request()
      .input('title', 'Siêu Quậy Marsupilami')
      .input('poster', 'images/movie_marsupilami.png')
      .input('trailer', 'https://www.youtube.com/watch?v=xzc6xQfWq4E')
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
    console.error('Error updating Siêu Quậy Marsupilami in database:', err);
    process.exit(1);
  }
}

main();

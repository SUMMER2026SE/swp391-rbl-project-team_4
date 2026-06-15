const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    
    // Update the movie "John Wick: Chapter 4" details in the database
    const result = await pool.request()
      .input('title', 'John Wick: Chapter 4')
      .input('poster', 'images/movie_john_wick_4.png')
      .input('trailer', 'https://www.youtube.com/watch?v=qEVUtrk8_B4')
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
    console.error('Error updating John Wick: Chapter 4 in database:', err);
    process.exit(1);
  }
}

main();

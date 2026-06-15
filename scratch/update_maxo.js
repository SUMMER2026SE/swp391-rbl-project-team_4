const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    
    // Update the movie "Ma Xó" details in the database
    const result = await pool.request()
      .input('title', 'Ma Xó')
      .input('poster', 'images/movie_maxo.png')
      .input('trailer', 'https://www.youtube.com/watch?v=MmE_ks7V1S0')
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
    console.error('Error updating Ma Xó in database:', err);
    process.exit(1);
  }
}

main();

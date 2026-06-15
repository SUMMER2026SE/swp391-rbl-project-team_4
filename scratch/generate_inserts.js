const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Movies');
    const movies = result.recordset;

    console.log('-- =======================================================');
    console.log('-- INSERT Movies GENERATED FROM DATABASE');
    console.log('-- =======================================================');
    
    // We will generate the insert statements
    for (const movie of movies) {
      const title = movie.Title ? `N'${movie.Title.replace(/'/g, "''")}'` : 'NULL';
      const desc = movie.Description ? `N'${movie.Description.replace(/'/g, "''")}'` : 'NULL';
      const dir = movie.Director ? `N'${movie.Director.replace(/'/g, "''")}'` : 'NULL';
      const dur = movie.Duration != null ? movie.Duration : 'NULL';
      const age = movie.AgeRating ? `'${movie.AgeRating.replace(/'/g, "''")}'` : 'NULL';
      const trailer = movie.TrailerURL ? `'${movie.TrailerURL.replace(/'/g, "''")}'` : 'NULL';
      const poster = movie.PosterURL ? `'${movie.PosterURL.replace(/'/g, "''")}'` : 'NULL';
      const status = movie.Status ? `'${movie.Status.replace(/'/g, "''")}'` : 'NULL';
      const cast = movie.MainCast ? `N'${movie.MainCast.replace(/'/g, "''")}'` : 'NULL';
      
      console.log(`INSERT INTO Movies (Title, Description, Director, Duration, AgeRating, TrailerURL, PosterURL, Status, MainCast) VALUES (${title}, ${desc}, ${dir}, ${dur}, ${age}, ${trailer}, ${poster}, ${status}, ${cast});`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();

const { getPool } = require('../config/db');

(async () => {
  try {
    const pool = await getPool();
    console.log("Connected to DB, updating movie genres...");
    
    await pool.request().query(`
      -- Update Movies table column values
      UPDATE Movies SET Genre = N'Tâm lý, Ly kì' WHERE MovieID = 12;
      UPDATE Movies SET Genre = N'Kinh dị' WHERE MovieID = 13;
      UPDATE Movies SET Genre = N'Tâm lý, Lịch sử' WHERE MovieID = 14;

      -- Delete any existing ones to avoid duplicate key errors
      DELETE FROM Movie_Genres WHERE MovieID IN (12, 13, 14);

      -- Insert junction table entries
      INSERT INTO Movie_Genres (MovieID, GenreID) VALUES (12, 7); -- Ốc Mượn Hồn -> Tâm lý (GenreID: 7)
      INSERT INTO Movie_Genres (MovieID, GenreID) VALUES (13, 3); -- Ma Xó -> Kinh dị (GenreID: 3)
      INSERT INTO Movie_Genres (MovieID, GenreID) VALUES (14, 7); -- Dưới Bóng Điện Hạ -> Tâm lý (GenreID: 7)
    `);
    
    console.log("Successfully updated movie genres in database!");
  } catch (err) {
    console.error("Failed to update movie genres:", err);
  } finally {
    process.exit(0);
  }
})();

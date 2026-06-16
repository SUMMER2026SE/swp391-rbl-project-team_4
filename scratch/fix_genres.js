const { getPool, sql } = require('../config/db');

async function fixGenres() {
  const pool = await getPool();
  try {
    // Ensure 'Ca Nhạc' and 'Ly Kì' exist
    await pool.request().query("IF NOT EXISTS(SELECT * FROM Genres WHERE GenreName=N'Ca Nhạc') INSERT INTO Genres (GenreName) VALUES (N'Ca Nhạc')");
    await pool.request().query("IF NOT EXISTS(SELECT * FROM Genres WHERE GenreName=N'Ly Kì') INSERT INTO Genres (GenreName) VALUES (N'Ly Kì')");

    const getGenreId = async (name) => {
      const res = await pool.request().input('name', sql.NVarChar, name).query("SELECT GenreID FROM Genres WHERE GenreName=@name");
      return res.recordset[0].GenreID;
    };

    const gCaNhac = await getGenreId('Ca Nhạc');
    const gHanhDong = await getGenreId('Hành động');
    const gHoatHinh = await getGenreId('Hoạt hình');
    const gKinhDi = await getGenreId('Kinh dị');
    const gTamLy = await getGenreId('Tâm lý');
    const gHai = await getGenreId('Hài');
    const gPhieuLuu = await getGenreId('Phiêu lưu');
    const gVienTuong = await getGenreId('Viễn tưởng');

    const inserts = [
      { m: 10, g: gKinhDi },
      { m: 11, g: gKinhDi },
      { m: 12, g: gTamLy },
      { m: 13, g: gHai }, { m: 13, g: gPhieuLuu },
      { m: 14, g: gHanhDong },
      { m: 15, g: gVienTuong }, { m: 15, g: gHoatHinh }, { m: 15, g: gPhieuLuu },
      { m: 16, g: gCaNhac },
      { m: 17, g: gKinhDi },
      { m: 18, g: gHanhDong },
      { m: 19, g: gHoatHinh }
    ];

    for (let {m, g} of inserts) {
      await pool.request()
        .input('m', sql.Int, m)
        .input('g', sql.Int, g)
        .query("IF NOT EXISTS(SELECT * FROM Movie_Genres WHERE MovieID=@m AND GenreID=@g) INSERT INTO Movie_Genres (MovieID, GenreID) VALUES (@m, @g)");
    }
    console.log("Fixed genres!");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
fixGenres();

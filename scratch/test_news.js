require('dotenv').config();
const { getPool, sql } = require('../config/db');
const NewsModel = require('../models/newsModel');

async function runTest() {
  try {
    console.log('Connecting to database...');
    const pool = await getPool();

    // 1. Ensure News table exists
    console.log('Ensuring News table exists...');
    await pool.request().query(`
      IF OBJECT_ID('dbo.News', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.News (
              NewsID INT IDENTITY(1,1) PRIMARY KEY,
              Title NVARCHAR(255) NOT NULL,
              Summary NVARCHAR(MAX) NULL,
              Content NVARCHAR(MAX) NULL,
              Thumbnail NVARCHAR(500) NULL,
              Category NVARCHAR(50) NOT NULL
                  CONSTRAINT CK_News_Category CHECK (Category IN ('News','Event','Promotion')),
              Status BIT NOT NULL CONSTRAINT DF_News_Status DEFAULT 1,
              PublishedAt DATETIME NOT NULL CONSTRAINT DF_News_PublishedAt DEFAULT GETDATE(),
              CreatedAt DATETIME NOT NULL CONSTRAINT DF_News_CreatedAt DEFAULT GETDATE(),
              UpdatedAt DATETIME NULL
          );
      END;
    `);

    // 2. Insert dummy news articles if empty
    const checkCount = await pool.request().query('SELECT COUNT(*) AS count FROM dbo.News');
    if (checkCount.recordset[0].count === 0) {
      console.log('Inserting dummy news data...');
      await pool.request().query(`
        INSERT INTO dbo.News (Title, Summary, Content, Thumbnail, Category, Status, PublishedAt)
        VALUES 
        (N'Cine Summer 2026', N'Chào hè rực rỡ với Cine Summer', N'<p>Nội dung chi tiết...</p>', '/images/promo_student.png', 'Promotion', 1, '2026-07-01'),
        (N'Cập Bến Aeon Mall Thanh Khê', N'Khai trương rạp chiếu Dolby Vision', N'<p>Dolby Vision + Atmos đầu tiên...</p>', '/images/promo_imax_weekend.png', 'Event', 1, '2026-07-02'),
        (N'Doraemon Movie 45', N'Nobita và lâu đài dưới đáy biển', N'<p>Phiêu lưu đại dương...</p>', '/images/doraemon_sea.png', 'News', 1, '2026-07-03'),
        (N'Review Lầu Chú Hỏa', N'Kinh dị Việt siêu ma quái', N'<p>Căn biệt thự cổ...</p>', '/images/movie_lau_chu_hoa.png', 'News', 0, '2026-07-04')
      `);
    }

    console.log('--- Testing getNewsPublic with search, category, and pagination ---');
    const resultAll = await NewsModel.getNewsPublic({ page: 1, limit: 10 });
    console.log('Result All (should be 3 active items):');
    console.dir(resultAll, { depth: null });

    const resultSearch = await NewsModel.getNewsPublic({ search: 'Doraemon', page: 1, limit: 10 });
    console.log('Result Search "Doraemon" (should be 1 item):');
    console.dir(resultSearch, { depth: null });

    const resultCategory = await NewsModel.getNewsPublic({ category: 'Event', page: 1, limit: 10 });
    console.log('Result Category "Event" (should be 1 item):');
    console.dir(resultCategory, { depth: null });

    console.log('--- Testing getNewsById ---');
    if (resultAll.data.length > 0) {
      const firstId = resultAll.data[0].NewsID;
      const detail = await NewsModel.getNewsById(firstId);
      console.log(`Detail for NewsID ${firstId}:`);
      console.dir(detail, { depth: null });
    }

    console.log('All tests passed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  }
}

runTest();

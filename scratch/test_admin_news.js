require('dotenv').config();

async function main() {
  try {
    console.log('Fetching news list from /api/admin/news on port 9998 (Admin Auth is bypassed or we need a token? Oh, admin routes require token!)...');
    // Let's query the database directly since checking direct SQL response is easier and bypasses JWT.
    const { getPool } = require('../config/db');
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT NewsID AS ArticleID, 
             CASE WHEN Category = 'Event' THEN 'events' ELSE 'news' END AS Type, 
             Title, 
             Summary, 
             Content, 
             Thumbnail AS ImageURL, 
             BadgeLabel,
             Author, 
             PublishedAt, 
             IsFeatured, 
             Status AS IsActive, 
             SortOrder, 
             CreatedAt, 
             UpdatedAt
      FROM dbo.News
      ORDER BY PublishedAt DESC, NewsID DESC
    `);
    console.log('Query result count:', result.recordset.length);
    console.log('First article:', result.recordset[0]);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();

require('dotenv').config();
const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    console.log('Copying missing articles from NewsArticles to News...');
    
    await pool.request().query(`
      INSERT INTO dbo.News (Title, Summary, Content, Thumbnail, Category, Status, PublishedAt, CreatedAt, UpdatedAt, BadgeLabel, Author, IsFeatured, SortOrder)
      SELECT 
        Title, 
        Summary, 
        Content, 
        ImageURL AS Thumbnail, 
        CASE WHEN Type = 'events' THEN 'Event' ELSE 'News' END AS Category,
        IsActive AS Status, 
        PublishedAt, 
        CreatedAt, 
        UpdatedAt, 
        BadgeLabel, 
        Author, 
        IsFeatured, 
        SortOrder
      FROM dbo.NewsArticles AS na
      WHERE NOT EXISTS (
        SELECT 1 FROM dbo.News AS n
        WHERE n.Title = na.Title AND n.Summary = na.Summary
      );
    `);
    
    console.log('Data migration completed successfully.');
  } catch (err) {
    console.error('Error migrating data:', err);
  }
}

main();

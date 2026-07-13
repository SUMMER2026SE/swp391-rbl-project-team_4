require('dotenv').config();
const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    
    console.log('--- dbo.News ---');
    const newsRes = await pool.request().query('SELECT * FROM dbo.News');
    console.log(newsRes.recordset);

    console.log('\n--- dbo.NewsArticles ---');
    const articlesRes = await pool.request().query('SELECT * FROM dbo.NewsArticles');
    console.log(articlesRes.recordset);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();

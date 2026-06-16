const fs = require('fs');
const path = require('path');
const { getPool } = require('../config/db');
require('dotenv').config();

function toHex(str) {
  return str.split('').map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ');
}

async function check() {
  try {
    // 1. Read string from booking.html
    const htmlPath = path.join(__dirname, '../public/booking.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Find the genreKeywords block or similar
    const keywordMatch = htmlContent.match(/action:\s*\[([^\]]+)\]/);
    console.log('Action keyword block in HTML:', keywordMatch ? keywordMatch[0] : 'not found');
    if (keywordMatch) {
      const keywordsStr = keywordMatch[1];
      const match = keywordsStr.match(/'([^']+)'/);
      if (match) {
        console.log("HTML 'hành động' hex:", toHex(match[1]));
      }
    }

    // 2. Read string from DB
    const pool = await getPool();
    const result = await pool.request().query("SELECT GenreName FROM Genres WHERE GenreName LIKE N'%Hành%'");
    if (result.recordset.length > 0) {
      const dbGenre = result.recordset[0].GenreName;
      console.log("DB '" + dbGenre + "' hex:", toHex(dbGenre));
      console.log("DB lowercase hex:", toHex(dbGenre.toLowerCase()));
    }

    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();

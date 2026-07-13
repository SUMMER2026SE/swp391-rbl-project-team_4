require('dotenv').config();
const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    console.log('Altering dbo.News table to add missing admin columns...');
    
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.News') AND name = 'BadgeLabel'
      )
      BEGIN
        ALTER TABLE dbo.News ADD BadgeLabel NVARCHAR(100) NULL;
        PRINT 'Added BadgeLabel column.';
      END;

      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.News') AND name = 'Author'
      )
      BEGIN
        ALTER TABLE dbo.News ADD Author NVARCHAR(100) NULL;
        PRINT 'Added Author column.';
      END;

      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.News') AND name = 'IsFeatured'
      )
      BEGIN
        ALTER TABLE dbo.News ADD IsFeatured BIT NOT NULL CONSTRAINT DF_News_IsFeatured DEFAULT 0;
        PRINT 'Added IsFeatured column.';
      END;

      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.News') AND name = 'SortOrder'
      )
      BEGIN
        ALTER TABLE dbo.News ADD SortOrder INT NOT NULL CONSTRAINT DF_News_SortOrder DEFAULT 0;
        PRINT 'Added SortOrder column.';
      END;
    `);
    
    console.log('dbo.News table altered successfully.');
  } catch (err) {
    console.error('Error altering table:', err);
  }
}

main();

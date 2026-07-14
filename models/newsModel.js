const { sql, getPool } = require('../config/db');

let schemaReady = false;

async function ensureNewsTable() {
  if (schemaReady) return;

  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.News', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.News (
        NewsID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Title NVARCHAR(255) NOT NULL,
        Summary NVARCHAR(1000) NULL,
        Content NVARCHAR(MAX) NULL,
        Thumbnail NVARCHAR(500) NULL,
        Category NVARCHAR(20) NOT NULL CONSTRAINT DF_News_Category DEFAULT 'News',
        Status BIT NOT NULL CONSTRAINT DF_News_Status DEFAULT 1,
        PublishedAt DATETIME NOT NULL CONSTRAINT DF_News_PublishedAt DEFAULT GETDATE(),
        BadgeLabel NVARCHAR(80) NULL,
        Author NVARCHAR(120) NULL,
        IsFeatured BIT NOT NULL CONSTRAINT DF_News_IsFeatured DEFAULT 0,
        SortOrder INT NOT NULL CONSTRAINT DF_News_SortOrder DEFAULT 0,
        CreatedAt DATETIME NOT NULL CONSTRAINT DF_News_CreatedAt DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT CK_News_Category CHECK (Category IN ('News', 'Event'))
      );
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'IX_News_Public'
        AND object_id = OBJECT_ID('dbo.News')
    )
    BEGIN
      CREATE INDEX IX_News_Public
      ON dbo.News (Status, Category, PublishedAt DESC, SortOrder)
      INCLUDE (Title, Summary, Thumbnail, BadgeLabel, Author, IsFeatured);
    END;

    IF OBJECT_ID('dbo.NewsArticles', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.NewsArticles (
        ArticleID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Type NVARCHAR(20) NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        Summary NVARCHAR(1000) NULL,
        Content NVARCHAR(MAX) NULL,
        ImageURL NVARCHAR(500) NULL,
        BadgeLabel NVARCHAR(80) NULL,
        Author NVARCHAR(120) NULL,
        PublishedAt DATETIME NOT NULL CONSTRAINT DF_NewsArticles_PublishedAt DEFAULT GETDATE(),
        IsFeatured BIT NOT NULL CONSTRAINT DF_NewsArticles_IsFeatured DEFAULT 0,
        IsActive BIT NOT NULL CONSTRAINT DF_NewsArticles_IsActive DEFAULT 1,
        SortOrder INT NOT NULL CONSTRAINT DF_NewsArticles_SortOrder DEFAULT 0,
        CreatedAt DATETIME NOT NULL CONSTRAINT DF_NewsArticles_CreatedAt DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT CK_NewsArticles_Type CHECK (Type IN ('news', 'events'))
      );
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'IX_NewsArticles_Public'
        AND object_id = OBJECT_ID('dbo.NewsArticles')
    )
    BEGIN
      CREATE INDEX IX_NewsArticles_Public
      ON dbo.NewsArticles (IsActive, Type, PublishedAt DESC, SortOrder)
      INCLUDE (Title, Summary, ImageURL, BadgeLabel, Author, IsFeatured);
    END;
  `);

  schemaReady = true;
}

function cleanArticleInput(data = {}) {
  const type = data.type === 'events' ? 'events' : 'news';
  const title = String(data.title || '').trim();
  const summary = String(data.summary || data.description || '').trim();
  const content = String(data.content || '').trim();
  const imageURL = String(data.imageURL || '').trim();
  const badgeLabel = String(data.badgeLabel || '').trim();
  const author = String(data.author || '').trim();
  const sortOrder = parseInt(data.sortOrder, 10);
  const publishedAt = data.publishedAt ? new Date(data.publishedAt) : new Date();

  return {
    type,
    title,
    summary,
    content,
    imageURL,
    badgeLabel,
    author,
    publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
    isFeatured: data.isFeatured === true || data.isFeatured === 'true' || data.isFeatured === '1',
    isActive: data.isActive === undefined ? true : (data.isActive === true || data.isActive === 'true' || data.isActive === '1'),
    sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
  };
}

class NewsModel {
  static async getPublicArticles({ type, search } = {}) {
    await ensureNewsTable();

    const pool = await getPool();
    const request = pool.request();
    let filters = 'WHERE IsActive = 1';

    if (type && type !== 'all') {
      request.input('type', sql.NVarChar, type === 'events' ? 'events' : 'news');
      filters += ' AND Type = @type';
    }

    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      filters += ' AND (Title LIKE @search OR Summary LIKE @search OR Content LIKE @search)';
    }

    const result = await request.query(`
      SELECT ArticleID, Type, Title, Summary, Content, ImageURL, BadgeLabel,
             Author, PublishedAt, IsFeatured, SortOrder
      FROM NewsArticles
      ${filters}
      ORDER BY IsFeatured DESC, SortOrder ASC, PublishedAt DESC, ArticleID DESC
    `);

    return result.recordset;
  }

  static async getAdminArticles() {
    await ensureNewsTable();

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

    return result.recordset;
  }

  static async createArticle(data) {
    await ensureNewsTable();
    const item = cleanArticleInput(data);
    if (!item.title) throw new Error('Vui long nhap tieu de bai viet.');

    const pool = await getPool();
    const category = item.type === 'events' ? 'Event' : 'News';
    const status = item.isActive ? 1 : 0;

    const result = await pool.request()
      .input('title', sql.NVarChar, item.title)
      .input('summary', sql.NVarChar, item.summary || null)
      .input('content', sql.NVarChar(sql.MAX), item.content || null)
      .input('thumbnail', sql.NVarChar, item.imageURL || null)
      .input('category', sql.NVarChar, category)
      .input('status', sql.Bit, status)
      .input('publishedAt', sql.DateTime, item.publishedAt)
      .input('badgeLabel', sql.NVarChar, item.badgeLabel || null)
      .input('author', sql.NVarChar, item.author || null)
      .input('isFeatured', sql.Bit, item.isFeatured)
      .input('sortOrder', sql.Int, item.sortOrder)
      .query(`
        INSERT INTO dbo.News
          (Title, Summary, Content, Thumbnail, Category, Status, PublishedAt, BadgeLabel, Author, IsFeatured, SortOrder)
        OUTPUT INSERTED.NewsID AS ArticleID, INSERTED.Title, INSERTED.Summary, INSERTED.PublishedAt
        VALUES
          (@title, @summary, @content, @thumbnail, @category, @status, @publishedAt, @badgeLabel, @author, @isFeatured, @sortOrder)
      `);

    return result.recordset[0];
  }

  static async updateArticle(id, data) {
    await ensureNewsTable();
    const newsId = parseInt(id, 10);
    const item = cleanArticleInput(data);
    if (!Number.isInteger(newsId) || newsId <= 0) throw new Error('NewsID khong hop le.');
    if (!item.title) throw new Error('Vui long nhap tieu de bai viet.');

    const pool = await getPool();
    const category = item.type === 'events' ? 'Event' : 'News';
    const status = item.isActive ? 1 : 0;

    const result = await pool.request()
      .input('newsId', sql.Int, newsId)
      .input('title', sql.NVarChar, item.title)
      .input('summary', sql.NVarChar, item.summary || null)
      .input('content', sql.NVarChar(sql.MAX), item.content || null)
      .input('thumbnail', sql.NVarChar, item.imageURL || null)
      .input('category', sql.NVarChar, category)
      .input('status', sql.Bit, status)
      .input('publishedAt', sql.DateTime, item.publishedAt)
      .input('badgeLabel', sql.NVarChar, item.badgeLabel || null)
      .input('author', sql.NVarChar, item.author || null)
      .input('isFeatured', sql.Bit, item.isFeatured)
      .input('sortOrder', sql.Int, item.sortOrder)
      .query(`
        UPDATE dbo.News
        SET Title = @title,
            Summary = @summary,
            Content = @content,
            Thumbnail = COALESCE(NULLIF(@thumbnail, ''), Thumbnail),
            Category = @category,
            Status = @status,
            PublishedAt = @publishedAt,
            BadgeLabel = @badgeLabel,
            Author = @author,
            IsFeatured = @isFeatured,
            SortOrder = @sortOrder,
            UpdatedAt = GETDATE()
        OUTPUT INSERTED.NewsID AS ArticleID, INSERTED.Title
        WHERE NewsID = @newsId
      `);

    return result.recordset[0] || null;
  }

  static async deleteArticle(id) {
    await ensureNewsTable();
    const newsId = parseInt(id, 10);
    const pool = await getPool();
    const result = await pool.request()
      .input('newsId', sql.Int, newsId)
      .query('DELETE FROM dbo.News WHERE NewsID = @newsId');
    return result.rowsAffected[0] > 0;
  }

  static async toggleArticleActive(id) {
    await ensureNewsTable();
    const newsId = parseInt(id, 10);
    const pool = await getPool();
    const result = await pool.request()
      .input('newsId', sql.Int, newsId)
      .query(`
        UPDATE dbo.News
        SET Status = CASE WHEN Status = 1 THEN 0 ELSE 1 END,
            UpdatedAt = GETDATE()
        OUTPUT INSERTED.NewsID AS ArticleID, INSERTED.Status AS IsActive
        WHERE NewsID = @newsId
      `);
    return result.recordset[0] || null;
  }

  // --- UC06 - News and Events Management ---
  static async getNewsPublic({ search, category, page = 1, limit = 10 } = {}) {
    await ensureNewsTable();
    const pool = await getPool();
    const request = pool.request();
    let filters = 'WHERE Status = 1';

    if (category) {
      request.input('category', sql.NVarChar, category);
      filters += ' AND Category = @category';
    }

    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      filters += ' AND (Title LIKE @search OR Summary LIKE @search OR Content LIKE @search)';
    }

    // Get total count for filters
    const countResult = await request.query(`
      SELECT COUNT(*) AS total
      FROM dbo.News
      ${filters}
    `);
    const totalItems = countResult.recordset[0].total;

    const offset = (page - 1) * limit;
    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, limit);

    const dataResult = await request.query(`
      SELECT NewsID, Title, Summary, Content, Thumbnail, Category, Status, PublishedAt, CreatedAt, UpdatedAt
      FROM dbo.News
      ${filters}
      ORDER BY PublishedAt DESC, NewsID DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    return {
      totalItems,
      data: dataResult.recordset
    };
  }

  static async getNewsById(id) {
    await ensureNewsTable();
    const newsId = parseInt(id, 10);
    if (!Number.isInteger(newsId) || newsId <= 0) return null;

    const pool = await getPool();
    const result = await pool.request()
      .input('newsId', sql.Int, newsId)
      .query(`
        SELECT NewsID, Title, Summary, Content, Thumbnail, Category, Status, PublishedAt, CreatedAt, UpdatedAt
        FROM dbo.News
        WHERE NewsID = @newsId AND Status = 1
      `);

    return result.recordset[0] || null;
  }
}

module.exports = NewsModel;

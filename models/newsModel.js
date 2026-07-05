const { sql, getPool } = require('../config/db');

let schemaReady = false;

async function ensureNewsTable() {
  if (schemaReady) return;

  const pool = await getPool();
  await pool.request().query(`
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
      SELECT ArticleID, Type, Title, Summary, Content, ImageURL, BadgeLabel,
             Author, PublishedAt, IsFeatured, IsActive, SortOrder, CreatedAt, UpdatedAt
      FROM NewsArticles
      ORDER BY PublishedAt DESC, ArticleID DESC
    `);

    return result.recordset;
  }

  static async createArticle(data) {
    await ensureNewsTable();
    const item = cleanArticleInput(data);
    if (!item.title) throw new Error('Vui long nhap tieu de bai viet.');

    const pool = await getPool();
    const result = await pool.request()
      .input('type', sql.NVarChar, item.type)
      .input('title', sql.NVarChar, item.title)
      .input('summary', sql.NVarChar, item.summary || null)
      .input('content', sql.NVarChar(sql.MAX), item.content || null)
      .input('imageURL', sql.NVarChar, item.imageURL || null)
      .input('badgeLabel', sql.NVarChar, item.badgeLabel || null)
      .input('author', sql.NVarChar, item.author || null)
      .input('publishedAt', sql.DateTime, item.publishedAt)
      .input('isFeatured', sql.Bit, item.isFeatured)
      .input('isActive', sql.Bit, item.isActive)
      .input('sortOrder', sql.Int, item.sortOrder)
      .query(`
        INSERT INTO NewsArticles
          (Type, Title, Summary, Content, ImageURL, BadgeLabel, Author, PublishedAt, IsFeatured, IsActive, SortOrder)
        OUTPUT INSERTED.*
        VALUES
          (@type, @title, @summary, @content, @imageURL, @badgeLabel, @author, @publishedAt, @isFeatured, @isActive, @sortOrder)
      `);

    return result.recordset[0];
  }

  static async updateArticle(id, data) {
    await ensureNewsTable();
    const articleId = parseInt(id, 10);
    const item = cleanArticleInput(data);
    if (!Number.isInteger(articleId) || articleId <= 0) throw new Error('ArticleID khong hop le.');
    if (!item.title) throw new Error('Vui long nhap tieu de bai viet.');

    const pool = await getPool();
    const result = await pool.request()
      .input('articleId', sql.Int, articleId)
      .input('type', sql.NVarChar, item.type)
      .input('title', sql.NVarChar, item.title)
      .input('summary', sql.NVarChar, item.summary || null)
      .input('content', sql.NVarChar(sql.MAX), item.content || null)
      .input('imageURL', sql.NVarChar, item.imageURL || null)
      .input('badgeLabel', sql.NVarChar, item.badgeLabel || null)
      .input('author', sql.NVarChar, item.author || null)
      .input('publishedAt', sql.DateTime, item.publishedAt)
      .input('isFeatured', sql.Bit, item.isFeatured)
      .input('isActive', sql.Bit, item.isActive)
      .input('sortOrder', sql.Int, item.sortOrder)
      .query(`
        UPDATE NewsArticles
        SET Type = @type,
            Title = @title,
            Summary = @summary,
            Content = @content,
            ImageURL = COALESCE(NULLIF(@imageURL, ''), ImageURL),
            BadgeLabel = @badgeLabel,
            Author = @author,
            PublishedAt = @publishedAt,
            IsFeatured = @isFeatured,
            IsActive = @isActive,
            SortOrder = @sortOrder,
            UpdatedAt = GETDATE()
        OUTPUT INSERTED.*
        WHERE ArticleID = @articleId
      `);

    return result.recordset[0] || null;
  }

  static async deleteArticle(id) {
    await ensureNewsTable();
    const articleId = parseInt(id, 10);
    const pool = await getPool();
    const result = await pool.request()
      .input('articleId', sql.Int, articleId)
      .query('DELETE FROM NewsArticles WHERE ArticleID = @articleId');
    return result.rowsAffected[0] > 0;
  }

  static async toggleArticleActive(id) {
    await ensureNewsTable();
    const articleId = parseInt(id, 10);
    const pool = await getPool();
    const result = await pool.request()
      .input('articleId', sql.Int, articleId)
      .query(`
        UPDATE NewsArticles
        SET IsActive = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END,
            UpdatedAt = GETDATE()
        OUTPUT INSERTED.*
        WHERE ArticleID = @articleId
      `);
    return result.recordset[0] || null;
  }
}

module.exports = NewsModel;

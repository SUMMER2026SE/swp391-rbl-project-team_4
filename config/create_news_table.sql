-- ==========================================
-- SQL Script: Create News Table
-- Description: Run this script in Azure Data Studio or SSMS to create the News table.
-- ==========================================

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
GO

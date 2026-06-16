-- ============================================================
--  promotions_migration.sql
--  Tạo bảng Promotions cho chức năng Tin tức & Khuyến mãi
--  Chạy script này trong SQL Server Management Studio
--  hoặc Azure Data Studio trên database CinemaManagement
-- ============================================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Promotions' AND xtype='U')
BEGIN
  CREATE TABLE Promotions (
    PromotionID   INT IDENTITY(1,1) PRIMARY KEY,
    Title         NVARCHAR(200)  NOT NULL,
    Description   NVARCHAR(MAX)  NULL,
    BadgeLabel    NVARCHAR(100)  NULL,
    ImageURL      VARCHAR(500)   NULL,
    LinkURL       VARCHAR(500)   NULL,
    IsFeatured    BIT            NOT NULL DEFAULT 0,
    IsActive      BIT            NOT NULL DEFAULT 1,
    SortOrder     INT            NOT NULL DEFAULT 0,
    CreatedAt     DATETIME       NOT NULL DEFAULT GETDATE(),
    UpdatedAt     DATETIME       NOT NULL DEFAULT GETDATE()
  );
  PRINT 'Bảng Promotions đã được tạo thành công.';
END
ELSE
BEGIN
  PRINT 'Bảng Promotions đã tồn tại, bỏ qua.';
END
GO

-- Seed data mẫu
IF NOT EXISTS (SELECT 1 FROM Promotions)
BEGIN
  INSERT INTO Promotions (Title, Description, BadgeLabel, ImageURL, LinkURL, IsFeatured, IsActive, SortOrder)
  VALUES
    (N'Unlimited Popcorn Thursdays',
     N'Tham gia chương trình Star Rewards ngay hôm nay và nhận bỏng ngô không giới hạn mỗi thứ năm với mọi lần mua vé.',
     N'MEMBER EXCLUSIVE',
     'images/combo_popcorn.png',
     'promotions.html',
     1, 1, 1),
    (N'Group Discounts',
     N'Tiết kiệm 20% cho đặt chỗ 10 vé trở lên',
     N'GROUP DISCOUNTS',
     'images/promo_student.png',
     'promotions.html',
     0, 1, 2),
    (N'IMAX Weekend',
     N'Trải nghiệm phim ở định dạng lớn nhất có thể',
     N'EXPERIENCE',
     'images/promo_imax_weekend.png',
     'promotions.html',
     0, 1, 3);
  PRINT 'Dữ liệu mẫu đã được thêm vào bảng Promotions.';
END
GO

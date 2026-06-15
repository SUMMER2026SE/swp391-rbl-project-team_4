-- ============================================================
--  payment_qr_migration.sql
--  Tạo bảng PaymentQRImages và seed dữ liệu QR cho 2 phương thức
--  Chạy file này trên SQL Server (CinemaManagement database)
-- ============================================================

USE CinemaManagement;
GO

-- Tạo bảng lưu thông tin QR thanh toán
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PaymentQRImages')
BEGIN
    CREATE TABLE PaymentQRImages (
        QRImageID     INT            IDENTITY(1,1) PRIMARY KEY,
        PaymentMethod NVARCHAR(50)   NOT NULL UNIQUE,
        ImagePath     NVARCHAR(500)  NOT NULL,           -- Đường dẫn file ảnh static (/images/...)
        DisplayName   NVARCHAR(200)  NOT NULL,
        Description   NVARCHAR(1000),
        AccountName   NVARCHAR(200),                     -- Tên chủ tài khoản
        AccountNumber NVARCHAR(100),                     -- Số tài khoản (nếu có)
        BankName      NVARCHAR(200),                     -- Tên ngân hàng / ví
        IsActive      BIT            DEFAULT 1,
        CreatedAt     DATETIME       DEFAULT GETDATE(),
        UpdatedAt     DATETIME       DEFAULT GETDATE()
    );
    PRINT 'Đã tạo bảng PaymentQRImages.';
END
ELSE
BEGIN
    PRINT 'Bảng PaymentQRImages đã tồn tại, bỏ qua tạo mới.';
END
GO

-- Xoá dữ liệu cũ nếu có (để seed lại sạch)
DELETE FROM PaymentQRImages WHERE PaymentMethod IN ('qrpay', 'momo');
GO

-- Seed 2 phương thức thanh toán
INSERT INTO PaymentQRImages (PaymentMethod, ImagePath, DisplayName, Description, AccountName, AccountNumber, BankName)
VALUES
(
    'qrpay',
    '/images/qr_vietqr_mb.png',
    N'QR Pay (VietQR / MB Bank)',
    N'Thanh toán nhanh qua VietQR – hỗ trợ 40+ ngân hàng qua Napas 247',
    N'D-CINEMA PAYMENT',
    N'',
    N'MB Bank'
),
(
    'momo',
    '/images/qr_momo.png',
    N'Ví điện tử MoMo',
    N'Quét mã QR bằng ứng dụng MoMo để thanh toán tức thì',
    N'D-CINEMA',
    N'',
    N'MoMo'
);
GO

PRINT 'Seed PaymentQRImages hoàn tất.';
PRINT 'Lưu ý: Đặt 2 file ảnh QR tại:';
PRINT '  - public/images/qr_vietqr_mb.png  (QR VietQR của MB Bank)';
PRINT '  - public/images/qr_momo.png       (QR MoMo)';
GO

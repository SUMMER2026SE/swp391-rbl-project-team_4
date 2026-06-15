-- ============================================================
--  payment_qr_migration.sql
--  Tạo / cập nhật bảng PaymentQRImages với thông tin tài khoản thật
--  Chạy file này trên SQL Server (CinemaManagement database)
--  Tài khoản: NGUYEN MINH HUY | MB Bank & MoMo: 0949391487
-- ============================================================

USE CinemaManagement;
GO

-- ─── Xóa bảng nếu đã tồn tại và tạo lại mới ─────────────────────
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PaymentQRImages')
BEGIN
    DROP TABLE PaymentQRImages;
    PRINT N'Đã xóa bảng cũ PaymentQRImages.';
END
GO

CREATE TABLE PaymentQRImages (
    QRImageID     INT            IDENTITY(1,1) PRIMARY KEY,
    PaymentMethod NVARCHAR(50)   NOT NULL UNIQUE,
    ImagePath     NVARCHAR(500)  NOT NULL,           -- Đường dẫn file ảnh static (fallback)
    DisplayName   NVARCHAR(200)  NOT NULL,
    Description   NVARCHAR(1000),
    AccountName   NVARCHAR(200),                     -- Tên chủ tài khoản
    AccountNumber NVARCHAR(100),                     -- Số tài khoản / SĐT
    BankName      NVARCHAR(200),                     -- Tên ngân hàng / ví
    BankCode      NVARCHAR(20),                      -- Mã ngân hàng theo chuẩn VietQR (VD: MB, VCB, TCB)
    IsActive      BIT            DEFAULT 1,
    CreatedAt     DATETIME       DEFAULT GETDATE(),
    UpdatedAt     DATETIME       DEFAULT GETDATE()
);
PRINT N'Đã tạo mới bảng PaymentQRImages.';
GO

-- ─── Xoá dữ liệu cũ để seed lại sạch ─────────────────────────
DELETE FROM PaymentQRImages WHERE PaymentMethod IN ('qrpay', 'momo');
GO

-- ─── Seed 2 phương thức thanh toán với thông tin tài khoản thật ───
INSERT INTO PaymentQRImages (PaymentMethod, ImagePath, DisplayName, Description, AccountName, AccountNumber, BankName, BankCode)
VALUES
(
    'qrpay',
    '/images/qr_vietqr_mb.png',
    N'QR Pay (VietQR / MB Bank)',
    N'Thanh toán nhanh qua VietQR – hỗ trợ 40+ ngân hàng qua Napas 247. Số tiền được điền tự động khi quét.',
    N'NGUYEN MINH HUY',
    N'0949391487',
    N'MB Bank',
    N'MB'
),
(
    'momo',
    '/images/qr_momo.png',
    N'Ví điện tử MoMo',
    N'Quét mã QR bằng ứng dụng MoMo hoặc ứng dụng Ngân hàng. Số tiền và nội dung chuyển khoản được điền tự động.',
    N'NGUYEN MINH HUY',
    N'PSP2605012400000587',
    N'MoMo',
    N'MOMO'
);
GO

PRINT N'Seed PaymentQRImages hoàn tất.';
PRINT N'';
PRINT N'Thông tin tài khoản:';
PRINT N'  MB Bank  | STK: 0949391487 | Chủ TK: NGUYEN MINH HUY | BankCode: MB';
PRINT N'  MoMo     | SĐT: 0949391487 | Chủ TK: NGUYEN MINH HUY';
PRINT N'';
PRINT N'VietQR URL mẫu (MB Bank):';
PRINT N'  https://img.vietqr.io/image/MB-0949391487-qr_only.png?amount=90000&addInfo=DCVIP123456&accountName=NGUYEN+MINH+HUY';
GO

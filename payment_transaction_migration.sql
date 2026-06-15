-- ============================================================
--  payment_transaction_migration.sql
--  Tạo bảng PaymentTransactions để lưu lịch sử giao dịch thanh toán
--  Chạy file này trên SQL Server (CinemaManagement database)
-- ============================================================

USE CinemaManagement;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PaymentTransactions')
BEGIN
    CREATE TABLE PaymentTransactions (
        TransactionID     INT            IDENTITY(1,1) PRIMARY KEY,
        Gateway           NVARCHAR(100)  NOT NULL,           -- Cổng thanh toán (SePay, PayOS, MBBank, MoMo, etc.)
        TransactionDate   DATETIME       NOT NULL,           -- Thời gian giao dịch phía ngân hàng
        AccountNumber     NVARCHAR(100)  NOT NULL,           -- Số tài khoản nhận tiền
        AmountIn          DECIMAL(18,2)  NOT NULL,           -- Số tiền nhận vào
        ReferenceNumber   NVARCHAR(200)  NOT NULL UNIQUE,    -- Mã tham chiếu duy nhất của ngân hàng (mã giao dịch FT...)
        TransactionContent NVARCHAR(1000) NOT NULL,          -- Nội dung chuyển khoản để đối soát
        PaymentMethod     NVARCHAR(50)   NOT NULL,           -- 'qrpay' hoặc 'momo'
        RawData           NVARCHAR(MAX),                     -- JSON dữ liệu gốc từ webhook
        CreatedAt         DATETIME       DEFAULT GETDATE()
    );
    PRINT N'Đã tạo bảng PaymentTransactions.';
END
ELSE
BEGIN
    PRINT N'Bảng PaymentTransactions đã tồn tại.';
END
GO

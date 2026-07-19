const db = require('./config/db');
(async () => {
    try {
        const pool = await db.getPool();
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Voucher]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[Voucher](
                    [VoucherID] [int] IDENTITY(1,1) NOT NULL,
                    [VoucherCode] [varchar](50) NOT NULL UNIQUE,
                    [VoucherType] [nvarchar](255) DEFAULT N'Mã Khuyến Mãi',
                    [VoucherName] [nvarchar](255) NOT NULL,
                    [DiscountType] [varchar](50) NOT NULL,
                    [DiscountValue] [decimal](18, 2) NOT NULL,
                    [MinimumOrder] [decimal](18, 2) DEFAULT 0,
                    [MaximumDiscount] [decimal](18, 2) DEFAULT 0,
                    [UsageLimit] [int] DEFAULT 1,
                    [UsedCount] [int] DEFAULT 0,
                    [StartDate] [datetime] NOT NULL,
                    [EndDate] [datetime] NOT NULL,
                    [Status] [varchar](50) DEFAULT 'Active',
                    [Description] [nvarchar](1000) NULL,
                    [ImageUrl] [nvarchar](max) NULL,
                    [CreatedAt] [datetime] DEFAULT GETDATE(),
                    PRIMARY KEY CLUSTERED ([VoucherID] ASC)
                );

                INSERT INTO Voucher (VoucherCode, VoucherName, DiscountType, DiscountValue, MinimumOrder, MaximumDiscount, UsageLimit, UsedCount, StartDate, EndDate, Status, Description)
                VALUES 
                ('KM10PERCENT', N'Khuyen mai 10% mua he', 'Percentage', 10.00, 100000.00, 50000.00, 100, 12, '2026-06-01', '2026-08-31', 'Active', N'Giam gia 10% toi da 50k cho don hang tu 100k.'),
                ('KM100KFIXED', N'Khuyen mai 100k tri an', 'Fixed Amount', 100000.00, 500000.00, 100000.00, 50, 5, '2026-06-01', '2026-07-31', 'Active', N'Giam truc tiep 100k cho hoa don tu 500k.'),
                ('KMEXPIRED', N'Khuyen mai da het han', 'Percentage', 20.00, 50000.00, 20000.00, 20, 20, '2026-01-01', '2026-03-01', 'Expired', N'Chuong trinh giam gia dau nam.');
                
                print 'Created Voucher table and inserted seed data.';
            END
            ELSE
            BEGIN
                print 'Voucher table already exists.';
            END
        `);
        console.log("Success: Voucher table created.");
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();

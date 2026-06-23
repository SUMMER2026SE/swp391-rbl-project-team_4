const { sql, getPool } = require('./config/db');

async function createSettingsTable() {
    try {
        const pool = await getPool();
        const request = pool.request();

        const query = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SystemSettings' AND xtype='U')
            BEGIN
                CREATE TABLE SystemSettings (
                    SettingKey VARCHAR(50) PRIMARY KEY,
                    SettingValue NVARCHAR(MAX),
                    Description NVARCHAR(255),
                    UpdatedAt DATETIME DEFAULT GETDATE()
                );

                INSERT INTO SystemSettings (SettingKey, SettingValue, Description) VALUES
                ('BASE_TICKET_PRICE', '50000', N'Giá vé cơ bản mặc định (VNĐ)'),
                ('VIP_MULTIPLIER', '1.2', N'Hệ số nhân cho ghế VIP'),
                ('COUPLE_MULTIPLIER', '1.5', N'Hệ số nhân cho ghế Couple/Sweetbox'),
                ('MAINTENANCE_MODE', 'false', N'Bật chế độ bảo trì hệ thống (true/false)'),
                ('HOTLINE', '1900 1234', N'Hotline liên hệ hệ thống rạp'),
                ('SUPPORT_EMAIL', 'support@dcinema.vn', N'Email hỗ trợ khách hàng');
                
                PRINT 'Table SystemSettings created and defaults inserted.';
            END
            ELSE
            BEGIN
                PRINT 'Table SystemSettings already exists.';
            END
        `;
        
        await request.query(query);
        console.log("Migration successful!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit();
    }
}

createSettingsTable();

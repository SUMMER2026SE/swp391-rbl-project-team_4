const { getPool, sql } = require('../config/db');

async function main() {
    try {
        console.log('Connecting to database...');
        const pool = await getPool();
        console.log('Creating table SeatLocks if not exists...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SeatLocks]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[SeatLocks] (
                    [ShowtimeID] INT NOT NULL,
                    [SeatID]     INT NOT NULL,
                    [SessionID]  NVARCHAR(100) NULL,
                    [SocketID]   NVARCHAR(100) NULL,
                    [ExpiresAt]  DATETIME NOT NULL,
                    PRIMARY KEY CLUSTERED ([ShowtimeID] ASC, [SeatID] ASC),
                    CONSTRAINT [FK_SeatLocks_Showtimes] FOREIGN KEY ([ShowtimeID]) REFERENCES [dbo].[Showtimes] ([ShowtimeID]) ON DELETE CASCADE,
                    CONSTRAINT [FK_SeatLocks_Seats] FOREIGN KEY ([SeatID]) REFERENCES [dbo].[Seats] ([SeatID]) ON DELETE CASCADE
                )
            END
        `);
        console.log('Table SeatLocks checked/created successfully!');
    } catch (e) {
        console.error('Error creating table:', e);
    } finally {
        process.exit();
    }
}

main();

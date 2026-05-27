const { getPool } = require('./config/db');

async function checkSchema() {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME IN ('Bookings', 'BookingTickets', 'Tickets', 'Showtimes', 'Movies')
            ORDER BY TABLE_NAME, ORDINAL_POSITION
        `);
        console.log("SCHEMA:");
        console.table(result.recordset);
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
checkSchema();

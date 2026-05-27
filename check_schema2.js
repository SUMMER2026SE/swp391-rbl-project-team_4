const { getPool } = require('./config/db');

async function checkSchema2() {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME IN ('Rooms', 'Seats')
            ORDER BY TABLE_NAME, ORDINAL_POSITION
        `);
        console.table(result.recordset);
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
checkSchema2();

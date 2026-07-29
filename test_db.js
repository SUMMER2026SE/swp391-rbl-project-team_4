const sql = require('mssql');
const config = require('./config/db');
async function run() {
    try {
        const pool = await sql.connect(config.dbConfig || {
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            server: process.env.DB_SERVER,
            database: process.env.DB_DATABASE,
            options: { encrypt: true, trustServerCertificate: true }
        });
        const res = await pool.request().query('SELECT TOP 5 SeatID, SeatType, PriceMultiplier FROM Seats WHERE SeatType = \'Couple\'');
        console.log(res.recordset);
    } catch (e) { console.error(e.message); }
}
run();

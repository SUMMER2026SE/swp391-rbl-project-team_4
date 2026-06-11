const { getPool } = require('./config/db');
(async () => {
    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT MovieID, Title, TrailerURL FROM Movies");
        console.log(result.recordset);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();

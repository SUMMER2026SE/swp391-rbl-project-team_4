const { getPool } = require('./config/db');
async function check() {
    try {
        const pool = await getPool();
        const r = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users'");
        r.recordset.forEach(x => console.log(x.COLUMN_NAME));
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
check();

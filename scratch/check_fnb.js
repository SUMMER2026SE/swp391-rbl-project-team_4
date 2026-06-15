const { getPool } = require('../config/db');

async function checkFnB() {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM FoodBeverages');
    console.log(JSON.stringify(result.recordset, null, 2));
    process.exit(0);
}

checkFnB().catch(console.error);

const { getPool } = require('./config/db');
getPool().then(pool => {
  return pool.request().query("SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('Movies', 'Users')");
}).then(r => {
  console.log(JSON.stringify(r.recordset, null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});

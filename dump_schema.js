const { getPool } = require('./config/db');
const fs = require('fs');
getPool().then(pool => {
  return pool.request().query("SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS");
}).then(r => {
  fs.writeFileSync('schema.json', JSON.stringify(r.recordset, null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});

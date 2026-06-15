const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const { dbConfig } = require('../config/db');

async function runSQLScript() {
  const sqlFilePath = path.join(__dirname, '../config/cinemamanagements.sql');
  const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');

  // Connection configuration without database select, since we create it in the script
  const initConfig = {
    ...dbConfig,
    database: 'master', // Start by connecting to master
    pool: { max: 1, min: 0 }
  };

  console.log('[InitDB] Connecting to SQL Server...');
  const pool = await sql.connect(initConfig);
  
  // Split the file contents by GO statements (case-insensitive, on new lines)
  const batches = sqlScript.split(/^\s*GO\s*$/im);

  console.log(`[InitDB] Split script into ${batches.length} batches.`);

  let batchIndex = 1;
  for (let batch of batches) {
    const query = batch.trim();
    if (!query) continue;

    try {
      console.log(`[InitDB] Executing batch ${batchIndex}/${batches.length}...`);
      await pool.request().query(query);
    } catch (err) {
      console.error(`[InitDB] ❌ Error in batch ${batchIndex}:`, err.message);
      console.error('SQL query chunk was:', query.substring(0, 300) + '...');
      throw err;
    }
    batchIndex++;
  }

  await sql.close();
  console.log('[InitDB] ✅ Database successfully initialized/reseeded!');
  process.exit(0);
}

runSQLScript().catch(err => {
  console.error('[InitDB] ❌ Execution failed:', err);
  process.exit(1);
});

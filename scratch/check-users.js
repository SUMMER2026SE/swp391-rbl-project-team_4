const { getPool } = require('../config/db');

async function check() {
  try {
    const pool = await getPool();

    console.log('--- Users ---');
    const roles = await pool.request().query('SELECT * FROM Roles');
    console.log('--- Roles ---');
    console.log(roles.recordset);

    const users = await pool.request().query(`
      SELECT TOP 10 UserID, RoleID, FullName, Email, IsActive FROM Users
    `);
    console.log('--- Users ---');
    console.log(users.recordset);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();

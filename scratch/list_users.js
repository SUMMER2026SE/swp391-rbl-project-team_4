require('dotenv').config();
const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    const res = await pool.request().query(`
      SELECT u.UserID, u.FullName, u.Email, u.Phone, r.RoleName
      FROM Users u
      JOIN Roles r ON u.RoleID = r.RoleID
    `);
    console.log(res.recordset);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();

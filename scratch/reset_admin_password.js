require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPool } = require('../config/db');

async function main() {
  try {
    const pool = await getPool();
    const hash = await bcrypt.hash('123456', 10);
    console.log('Hashed password:', hash);
    
    const result = await pool.request()
      .input('email', 'Tandat@gmail.com')
      .input('hash', hash)
      .query('UPDATE Users SET PasswordHash = @hash WHERE Email = @email');
      
    console.log('Password reset successfully for Tandat@gmail.com. Rows affected:', result.rowsAffected[0]);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();

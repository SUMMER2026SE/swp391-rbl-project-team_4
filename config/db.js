require('dotenv').config();
const sql = require('mssql');

const dbConfig = {
<<<<<<< Updated upstream
  user: process.env.DB_USER || 'sa',                        // SQL Server login
  password: process.env.DB_PASSWORD || '210605',   // Đổi thành password thật của bạn
  server: process.env.DB_SERVER || 'localhost',               // Hoặc tên server / IP Azure
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  database: process.env.DB_DATABASE || 'CinemaManagement',             // Tên database trên SQL Server
=======
  user: 'sa',                        // SQL Server login
  password: '210605',   // Đổi thành password thật của bạn
  server: 'localhost',               // Hoặc tên server / IP Azure
  port: 1433,
  database: 'CinemaManagement',             // Tên database trên SQL Server
>>>>>>> Stashed changes
  options: {
    encrypt: false,                  // true nếu dùng Azure SQL
    trustServerCertificate: true,    // Bỏ qua self-signed cert (local dev)
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Singleton connection pool
let pool = null;

/**
 * Trả về connection pool đã được khởi tạo.
 * Gọi hàm này trước mọi truy vấn CSDL.
 */
async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect(dbConfig);
      console.log('[DB] ✅  Kết nối SQL Server thành công –', dbConfig.database);
    } catch (err) {
      console.error('[DB] ❌  Kết nối thất bại:', err.message);
      throw err;
    }
  }
  return pool;
}

module.exports = { sql, dbConfig, getPool };

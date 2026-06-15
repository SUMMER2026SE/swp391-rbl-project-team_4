// ============================================================
//  config/db.js  –  SQL Server connection (mssql + tedious)
//  Quản lý qua Azure Data Studio: dùng đúng server/database bên dưới
// ============================================================
const sql = require('mssql');

const dbConfig = {
  user: 'sa',                        // SQL Server login
  password: '12345',   // Đổi thành password thật của bạn
  server: 'localhost',               // Hoặc tên server / IP Azure
  port: 1433,
  database: 'CinemaManagement',             // Tên database trên SQL Server
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

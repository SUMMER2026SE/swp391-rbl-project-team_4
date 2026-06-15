// ============================================================
//  config/db.js  –  SQL Server connection (mssql + tedious)
//  Quản lý qua Azure Data Studio: dùng đúng server/database bên dưới
// ============================================================
const sql = require('mssql');

const dbConfig = {
  user: process.env.DB_USER || 'sa',                        // SQL Server login
  password: process.env.DB_PASSWORD || '123456',            // Đổi thành password thật của bạn
  server: process.env.DB_SERVER || 'localhost',             // Hoặc tên server / IP Azure
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || 'CinemaManagement',  // Tên database trên SQL Server
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',             // true nếu dùng Azure SQL
    trustServerCertificate: true,                           // Bỏ qua self-signed cert (local dev)
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

async function ensurePaymentTransactionsTable(connectionPool) {
  try {
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PaymentTransactions')
      BEGIN
        CREATE TABLE PaymentTransactions (
            TransactionID     INT            IDENTITY(1,1) PRIMARY KEY,
            Gateway           NVARCHAR(100)  NOT NULL,
            TransactionDate   DATETIME       NOT NULL,
            AccountNumber     NVARCHAR(100)  NOT NULL,
            AmountIn          DECIMAL(18,2)  NOT NULL,
            ReferenceNumber   NVARCHAR(200)  NOT NULL UNIQUE,
            TransactionContent NVARCHAR(1000) NOT NULL,
            PaymentMethod     NVARCHAR(50)   NOT NULL,
            RawData           NVARCHAR(MAX),
            CreatedAt         DATETIME       DEFAULT GETDATE()
        );
        PRINT 'Created PaymentTransactions table.';
      END
    `;
    await connectionPool.request().query(createTableQuery);
    console.log('[DB] ✅ Bảng PaymentTransactions đã được đồng bộ thành công.');
  } catch (err) {
    console.error('[DB] ❌ Lỗi kiểm tra/khởi tạo bảng PaymentTransactions:', err.message);
  }
}

/**
 * Trả về connection pool đã được khởi tạo.
 * Gọi hàm này trước mọi truy vấn CSDL.
 */
async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect(dbConfig);
      console.log('[DB] ✅  Kết nối SQL Server thành công –', dbConfig.database);
      await ensurePaymentTransactionsTable(pool);
    } catch (err) {
      console.error('[DB] ❌  Kết nối thất bại:', err.message);
      throw err;
    }
  }
  return pool;
}

module.exports = { sql, dbConfig, getPool };
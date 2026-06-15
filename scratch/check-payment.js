const { getPool } = require('../config/db');

async function checkPaymentTables() {
  try {
    const pool = await getPool();

    console.log('\n--- PaymentTransactions table structure ---');
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'PaymentTransactions'
      ORDER BY ORDINAL_POSITION
    `);
    console.log(cols.recordset);

    console.log('\n--- All records in PaymentTransactions ---');
    const txns = await pool.request().query(`
      SELECT TOP 20 TransactionID, Gateway, TransactionDate, AmountIn, ReferenceNumber, PaymentMethod, CreatedAt
      FROM PaymentTransactions
      ORDER BY CreatedAt DESC
    `);
    console.log(txns.recordset.length ? txns.recordset : '(no records yet)');

    console.log('\n--- Pending Tickets ---');
    const pending = await pool.request().query(`
      SELECT TOP 20 t.TicketID, t.Status, t.TotalAmount, t.BookedAt,
             u.FullName, m.Title AS Movie
      FROM Tickets t
      JOIN Users u ON t.UserID = u.UserID
      JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
      JOIN Movies m ON st.MovieID = m.MovieID
      WHERE t.Status = 'pending'
      ORDER BY t.BookedAt DESC
    `);
    console.log(pending.recordset.length ? pending.recordset : '(no pending tickets)');

    console.log('\n--- Confirmed Tickets (last 5) ---');
    const confirmed = await pool.request().query(`
      SELECT TOP 5 t.TicketID, t.Status, t.TotalAmount, t.BookedAt,
             u.FullName, m.Title AS Movie
      FROM Tickets t
      JOIN Users u ON t.UserID = u.UserID
      JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
      JOIN Movies m ON st.MovieID = m.MovieID
      WHERE t.Status = 'confirmed'
      ORDER BY t.BookedAt DESC
    `);
    console.log(confirmed.recordset.length ? confirmed.recordset : '(no confirmed tickets yet)');

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkPaymentTables();

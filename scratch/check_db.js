const { getPool } = require('../config/db');
require('dotenv').config();

async function check() {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Tickets WHERE TicketID = 12');
    console.log('Ticket 12:', result.recordset);
    
    const transactions = await pool.request().query('SELECT * FROM PaymentTransactions');
    console.log('PaymentTransactions:', transactions.recordset);
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();

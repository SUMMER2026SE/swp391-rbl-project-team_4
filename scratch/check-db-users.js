const { getPool } = require('../config/db');

(async () => {
  try {
    const pool = await getPool();

    // Lấy users Customer
    const r = await pool.request().query(
      "SELECT TOP 5 u.UserID, u.Email, u.FullName, u.IsActive, ro.RoleName " +
      "FROM Users u JOIN Roles ro ON u.RoleID = ro.RoleID " +
      "WHERE ro.RoleName = 'Customer' AND u.IsActive = 1 ORDER BY u.UserID"
    );
    console.log('=== Users (Customer, Active) ===');
    r.recordset.forEach(u => console.log(`  UserID=${u.UserID} | ${u.Email} | ${u.FullName}`));

    // Lấy suất chiếu active
    const st = await pool.request().query(
      "SELECT TOP 5 st.ShowtimeID, st.StartTime, m.Title, COALESCE(st.Price, st.BasePrice, 0) AS Price " +
      "FROM Showtimes st JOIN Movies m ON st.MovieID = m.MovieID " +
      "WHERE st.Status = 'active' AND st.StartTime > GETDATE() ORDER BY st.StartTime"
    );
    console.log('\n=== Active Showtimes ===');
    st.recordset.forEach(s => console.log(`  ShowtimeID=${s.ShowtimeID} | "${s.Title}" | Giá: ${s.Price}đ | ${new Date(s.StartTime).toLocaleString('vi-VN')}`));

    // Lấy ghế trống của suất chiếu đầu tiên
    if (st.recordset.length > 0) {
      const showtimeId = st.recordset[0].ShowtimeID;
      const seats = await pool.request().query(
        `SELECT TOP 5 s.SeatID, s.SeatRow, s.SeatNumber, s.SeatType, ` +
        `CASE WHEN t.TicketID IS NOT NULL THEN 'booked' ELSE 'available' END AS Status ` +
        `FROM Seats s ` +
        `LEFT JOIN Tickets t ON s.SeatID = t.SeatID AND t.ShowtimeID = ${showtimeId} AND t.Status IN ('confirmed','pending') ` +
        `WHERE s.HallID = (SELECT HallID FROM Showtimes WHERE ShowtimeID = ${showtimeId}) ` +
        `AND t.TicketID IS NULL`
      );
      console.log(`\n=== Ghế trống của ShowtimeID=${showtimeId} (5 ghế đầu) ===`);
      seats.recordset.forEach(s => console.log(`  SeatID=${s.SeatID} | ${s.SeatRow}${s.SeatNumber} | Type: ${s.SeatType}`));
    }

    // Lấy tickets pending hiện tại
    const pending = await pool.request().query(
      "SELECT TOP 5 t.TicketID, t.Status, u.Email, t.TotalAmount, t.PaymentMethod, t.BookedAt " +
      "FROM Tickets t JOIN Users u ON t.UserID = u.UserID " +
      "WHERE t.Status = 'pending' ORDER BY t.BookedAt DESC"
    );
    console.log('\n=== Pending Tickets ===');
    pending.recordset.forEach(t => console.log(`  TicketID=${t.TicketID} | ${t.Email} | ${t.TotalAmount}đ | ${t.PaymentMethod} | ${new Date(t.BookedAt).toLocaleString('vi-VN')}`));

    process.exit(0);
  } catch (e) {
    console.error('Lỗi:', e.message);
    process.exit(1);
  }
})();

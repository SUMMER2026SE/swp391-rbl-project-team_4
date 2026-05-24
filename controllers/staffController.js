// ============================================================
//  controllers/staffController.js  –  Staff / Counter APIs
//  Dành cho: Nhân viên tại quầy (Role: Staff, Manager, Admin)
// ============================================================
const { getPool, sql } = require('../config/db');

// ─────────────────────────────────────────────────────────────
//  GET /api/staff/showtimes/today
//  Lịch chiếu trong ngày hôm nay (để nhân viên chọn bán vé)
// ─────────────────────────────────────────────────────────────
exports.getTodayShowtimes = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT st.ShowtimeID, st.StartTime, st.EndTime, st.Price, st.Status,
             m.Title AS MovieTitle, m.Duration,
             r.RoomName,
             c.CinemaName
      FROM   Showtimes st
      JOIN   Movies  m ON st.MovieID = m.MovieID
      JOIN   Rooms   r ON st.RoomID  = r.RoomID
      JOIN   Cinemas c ON r.CinemaID = c.CinemaID
      WHERE  CAST(st.StartTime AS DATE) = CAST(GETDATE() AS DATE)
        AND  st.Status = 'active'
      ORDER BY st.StartTime ASC
    `);
    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    console.error('[staffController] getTodayShowtimes:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/staff/sell-ticket
//  Nhân viên bán vé trực tiếp tại quầy (không cần user login của khách)
//  Body: {
//    showtimeId, seatIds: [1, 2],
//    foodItems: [{ fnbId, quantity }],
//    customerPhone?,
//    voucherCode?,
//    paymentMethod: 'cash' | 'card'
//  }
// ─────────────────────────────────────────────────────────────
exports.sellTicketAtCounter = async (req, res) => {
  const { showtimeId, seatIds, foodItems = [], customerPhone, voucherCode, paymentMethod = 'cash' } = req.body;

  if (!showtimeId || !seatIds || seatIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp showtimeId và seatIds.' });
  }

  const pool = await getPool();
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // --- Tìm user theo số điện thoại (nếu có) ---
    let customerId = null;
    if (customerPhone) {
      const phoneReq = transaction.request();
      phoneReq.input('phone', sql.NVarChar, customerPhone);
      const phoneResult = await phoneReq.query('SELECT UserID FROM Users WHERE Phone = @phone');
      if (phoneResult.recordset.length > 0) {
        customerId = phoneResult.recordset[0].UserID;
      }
    }

    // --- Lấy giá vé ---
    const stReq = transaction.request();
    stReq.input('showtimeId', sql.Int, showtimeId);
    const stResult = await stReq.query('SELECT Price FROM Showtimes WHERE ShowtimeID = @showtimeId AND Status = \'active\'');
    if (stResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Suất chiếu không tồn tại.' });
    }
    const ticketPrice = stResult.recordset[0].Price;

    // --- Kiểm tra ghế còn trống ---
    for (const seatId of seatIds) {
      const sReq = transaction.request();
      sReq.input('seatId', sql.Int, seatId);
      sReq.input('showtimeId', sql.Int, showtimeId);
      const sCheck = await sReq.query(`
        SELECT TicketID FROM Tickets
        WHERE SeatID = @seatId AND ShowtimeID = @showtimeId AND Status IN ('confirmed','pending')
      `);
      if (sCheck.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: `Ghế ID ${seatId} đã được đặt.` });
      }
    }

    // --- Tính F&B ---
    let fnbTotal = 0;
    for (const item of foodItems) {
      const fReq = transaction.request();
      fReq.input('fnbId', sql.Int, item.fnbId);
      const fResult = await fReq.query('SELECT Price FROM FoodBeverages WHERE FnBID = @fnbId AND IsAvailable = 1');
      if (fResult.recordset.length > 0) {
        fnbTotal += fResult.recordset[0].Price * item.quantity;
      }
    }

    let totalAmount = ticketPrice * seatIds.length + fnbTotal;

    // --- Voucher ---
    let voucherId = null;
    let discountAmount = 0;
    if (voucherCode) {
      const vReq = transaction.request();
      vReq.input('code', sql.NVarChar, voucherCode.trim().toUpperCase());
      const vResult = await vReq.query(`
        SELECT VoucherID, DiscountType, DiscountValue, MaxDiscount, MinOrderValue
        FROM Vouchers WHERE Code = @code AND IsActive = 1
          AND StartDate <= GETDATE() AND EndDate >= GETDATE()
          AND (UsageLimit IS NULL OR UsedCount < UsageLimit)
      `);
      if (vResult.recordset.length > 0) {
        const v = vResult.recordset[0];
        voucherId = v.VoucherID;
        if (totalAmount >= (v.MinOrderValue || 0)) {
          discountAmount = v.DiscountType === 'percent'
            ? Math.min(totalAmount * v.DiscountValue / 100, v.MaxDiscount || Infinity)
            : Math.min(v.DiscountValue, totalAmount);
        }
      }
    }

    const finalAmount = totalAmount - discountAmount;

    // --- Tạo vé với trạng thái 'confirmed' ngay (bán tại quầy) ---
    const createdTickets = [];
    for (const seatId of seatIds) {
      const tReq = transaction.request();
      tReq.input('userId',        sql.Int,      customerId);
      tReq.input('showtimeId',    sql.Int,      showtimeId);
      tReq.input('seatId',        sql.Int,      seatId);
      tReq.input('voucherId',     sql.Int,      voucherId);
      tReq.input('ticketPrice',   sql.Decimal,  ticketPrice);
      tReq.input('totalAmount',   sql.Decimal,  finalAmount / seatIds.length);
      tReq.input('paymentMethod', sql.NVarChar, paymentMethod);
      tReq.input('soldBy',        sql.Int,      req.user.userId); // Staff ID

      const tResult = await tReq.query(`
        INSERT INTO Tickets (UserID, ShowtimeID, SeatID, VoucherID, TicketPrice,
                             TotalAmount, PaymentMethod, Status, SoldBy, BookedAt)
        OUTPUT INSERTED.TicketID
        VALUES (@userId, @showtimeId, @seatId, @voucherId, @ticketPrice,
                @totalAmount, @paymentMethod, 'confirmed', @soldBy, GETDATE())
      `);
      const ticketId = tResult.recordset[0].TicketID;
      createdTickets.push(ticketId);

      for (const item of foodItems) {
        const fReq2 = transaction.request();
        fReq2.input('ticketId', sql.Int, ticketId);
        fReq2.input('fnbId',    sql.Int, item.fnbId);
        fReq2.input('quantity', sql.Int, item.quantity);
        await fReq2.query(`
          INSERT INTO Ticket_FnB (TicketID, FnBID, Quantity)
          VALUES (@ticketId, @fnbId, @quantity)
        `);
      }
    }

    // Cập nhật voucher usage
    if (voucherId) {
      const vuReq = transaction.request();
      vuReq.input('voucherId', sql.Int, voucherId);
      await vuReq.query('UPDATE Vouchers SET UsedCount = UsedCount + 1 WHERE VoucherID = @voucherId');
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Bán vé tại quầy thành công!',
      data: {
        ticketIds:     createdTickets,
        totalSeats:    seatIds.length,
        ticketPrice,
        fnbTotal,
        discountAmount,
        finalAmount,
        paymentMethod,
        status:        'confirmed',
        soldBy:        req.user.userId,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error('[staffController] sellTicketAtCounter:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server khi bán vé.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/staff/check-ticket
//  Kiểm tra vé qua QR Code hoặc TicketID
//  Body: { ticketId } hoặc { qrCode }
// ─────────────────────────────────────────────────────────────
exports.checkTicket = async (req, res) => {
  try {
    const { ticketId, qrCode } = req.body;

    if (!ticketId && !qrCode) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ticketId hoặc qrCode.' });
    }

    const pool = await getPool();
    const request = pool.request();

    let whereClause = '';
    if (ticketId) {
      request.input('ticketId', sql.Int, parseInt(ticketId));
      whereClause = 'WHERE t.TicketID = @ticketId';
    } else {
      request.input('qrCode', sql.NVarChar, qrCode);
      whereClause = 'WHERE t.QRCode = @qrCode';
    }

    const result = await request.query(`
      SELECT t.TicketID, t.Status, t.BookedAt, t.CheckedAt,
             u.FullName AS CustomerName, u.Phone AS CustomerPhone,
             m.Title AS MovieTitle,
             st.StartTime, st.EndTime,
             r.RoomName,
             c.CinemaName,
             s.SeatRow, s.SeatNumber, s.SeatType
      FROM   Tickets t
      JOIN   Showtimes st ON t.ShowtimeID = st.ShowtimeID
      JOIN   Movies    m  ON st.MovieID   = m.MovieID
      JOIN   Rooms     r  ON st.RoomID    = r.RoomID
      JOIN   Cinemas   c  ON r.CinemaID   = c.CinemaID
      JOIN   Seats     s  ON t.SeatID     = s.SeatID
      LEFT   JOIN Users u ON t.UserID     = u.UserID
      ${whereClause}
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vé.' });
    }

    const ticket = result.recordset[0];

    // --- Kiểm tra trạng thái vé ---
    if (ticket.Status === 'used') {
      return res.status(200).json({
        success: false,
        valid: false,
        message: 'Vé đã được sử dụng rồi!',
        ticket,
      });
    }
    if (ticket.Status !== 'confirmed') {
      return res.status(200).json({
        success: false,
        valid: false,
        message: `Vé không hợp lệ. Trạng thái: ${ticket.Status}`,
        ticket,
      });
    }

    // --- Đánh dấu vé đã dùng ---
    const updateReq = pool.request();
    updateReq.input('ticketId', sql.Int, ticket.TicketID);
    await updateReq.query(`
      UPDATE Tickets
      SET Status = 'used', CheckedAt = GETDATE()
      WHERE TicketID = @ticketId
    `);

    res.json({
      success: true,
      valid: true,
      message: '✅ Vé hợp lệ! Cho khách vào.',
      ticket: { ...ticket, Status: 'used' },
    });
  } catch (err) {
    console.error('[staffController] checkTicket:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/staff/showtimes/:showtimeId/seats
//  Xem trạng thái ghế để bán tại quầy
// ─────────────────────────────────────────────────────────────
exports.getSeatsForSale = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('showtimeId', sql.Int, parseInt(req.params.showtimeId))
      .query(`
        SELECT s.SeatID, s.SeatRow, s.SeatNumber, s.SeatType,
               CASE WHEN t.SeatID IS NOT NULL THEN 'booked' ELSE 'available' END AS SeatStatus
        FROM   Seats s
        JOIN   Showtimes st ON s.RoomID = st.RoomID
        LEFT   JOIN Tickets t ON t.SeatID = s.SeatID AND t.ShowtimeID = @showtimeId
                              AND t.Status IN ('confirmed', 'pending')
        WHERE  st.ShowtimeID = @showtimeId
        ORDER BY s.SeatRow, s.SeatNumber
      `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[staffController] getSeatsForSale:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

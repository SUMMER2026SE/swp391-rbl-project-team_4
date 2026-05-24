// ============================================================
//  controllers/bookingController.js  –  Booking / Ticket APIs
//  Dành cho: Khách hàng đã đăng nhập (Role: Customer trở lên)
// ============================================================
const { getPool, sql } = require('../config/db');

// ─────────────────────────────────────────────────────────────
//  GET /api/bookings/food-beverages
//  Danh sách đồ ăn/thức uống có thể thêm vào vé
// ─────────────────────────────────────────────────────────────
exports.getFoodBeverages = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT FnBID, Name, Category, Price, ImageURL, IsAvailable
      FROM   FoodBeverages
      WHERE  IsAvailable = 1
      ORDER BY Category, Name
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('[bookingController] getFoodBeverages:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/bookings/validate-voucher
//  Body: { voucherCode }
//  Kiểm tra voucher còn hiệu lực không và trả về % giảm
// ─────────────────────────────────────────────────────────────
exports.validateVoucher = async (req, res) => {
  try {
    const { voucherCode } = req.body;
    if (!voucherCode) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã voucher.' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('code', sql.NVarChar, voucherCode.trim().toUpperCase())
      .query(`
        SELECT VoucherID, Code, DiscountType, DiscountValue,
               MinOrderValue, MaxDiscount, UsageLimit, UsedCount,
               StartDate, EndDate, IsActive
        FROM   Vouchers
        WHERE  Code = @code
          AND  IsActive = 1
          AND  StartDate <= GETDATE()
          AND  EndDate   >= GETDATE()
          AND  (UsageLimit IS NULL OR UsedCount < UsageLimit)
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mã voucher không hợp lệ, đã hết hạn hoặc đã dùng hết.',
      });
    }

    const voucher = result.recordset[0];
    res.json({
      success: true,
      message: 'Voucher hợp lệ!',
      voucher: {
        voucherId: voucher.VoucherID,
        code: voucher.Code,
        discountType: voucher.DiscountType,   // 'percent' | 'fixed'
        discountValue: voucher.DiscountValue,
        maxDiscount: voucher.MaxDiscount,
        minOrderValue: voucher.MinOrderValue,
      },
    });
  } catch (err) {
    console.error('[bookingController] validateVoucher:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/bookings
//  Tạo đơn đặt vé mới
//  Body: {
//    showtimeId, seatIds: [1,2,...],
//    foodItems: [{ fnbId, quantity }, ...],
//    voucherCode?,
//    paymentMethod: 'online' | 'counter'
//  }
// ─────────────────────────────────────────────────────────────
exports.createBooking = async (req, res) => {
  const { showtimeId, seatIds, foodItems = [], voucherCode, paymentMethod = 'online' } = req.body;

  if (!showtimeId || !seatIds || seatIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp showtimeId và seatIds.' });
  }

  const pool = await getPool();
  const transaction = pool.transaction();

  try {
    await transaction.begin();
    const req2 = transaction.request();

    // --- Lấy giá vé từ showtime ---
    req2.input('showtimeId', sql.Int, showtimeId);
    const stResult = await req2.query('SELECT Price FROM Showtimes WHERE ShowtimeID = @showtimeId AND Status = \'active\'');
    if (stResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Suất chiếu không tồn tại hoặc đã đóng.' });
    }
    const ticketPrice = stResult.recordset[0].Price;

    // --- Kiểm tra ghế chưa bị đặt ---
    for (const seatId of seatIds) {
      const seatReq = transaction.request();
      seatReq.input('sid', sql.Int, seatId);
      seatReq.input('stid', sql.Int, showtimeId);
      const seatCheck = await seatReq.query(`
        SELECT TicketID FROM Tickets
        WHERE SeatID = @sid AND ShowtimeID = @stid AND Status IN ('confirmed','pending')
      `);
      if (seatCheck.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: `Ghế ID ${seatId} đã được đặt.` });
      }
    }

    // --- Tính tổng tiền vé ---
    let totalAmount = ticketPrice * seatIds.length;

    // --- Cộng thêm F&B ---
    let fnbTotal = 0;
    for (const item of foodItems) {
      const fnbReq = transaction.request();
      fnbReq.input('fnbId', sql.Int, item.fnbId);
      const fnbResult = await fnbReq.query('SELECT Price FROM FoodBeverages WHERE FnBID = @fnbId AND IsAvailable = 1');
      if (fnbResult.recordset.length > 0) {
        fnbTotal += fnbResult.recordset[0].Price * item.quantity;
      }
    }
    totalAmount += fnbTotal;

    // --- Áp dụng voucher ---
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

    // --- Tạo Ticket cho mỗi ghế ---
    const createdTickets = [];
    for (const seatId of seatIds) {
      const tReq = transaction.request();
      tReq.input('userId', sql.Int, req.user.userId);
      tReq.input('showtimeId', sql.Int, showtimeId);
      tReq.input('seatId', sql.Int, seatId);
      tReq.input('voucherId', sql.Int, voucherId);
      tReq.input('ticketPrice', sql.Decimal, ticketPrice);
      tReq.input('totalAmount', sql.Decimal, finalAmount / seatIds.length);
      tReq.input('paymentMethod', sql.NVarChar, paymentMethod);

      const tResult = await tReq.query(`
        INSERT INTO Tickets (UserID, ShowtimeID, SeatID, VoucherID, TicketPrice,
                             TotalAmount, PaymentMethod, Status, BookedAt)
        OUTPUT INSERTED.TicketID
        VALUES (@userId, @showtimeId, @seatId, @voucherId, @ticketPrice,
                @totalAmount, @paymentMethod, 'pending', GETDATE())
      `);
      const ticketId = tResult.recordset[0].TicketID;
      createdTickets.push(ticketId);

      // --- Thêm F&B vào Ticket_FnB ---
      for (const item of foodItems) {
        const fnbReq2 = transaction.request();
        fnbReq2.input('ticketId', sql.Int, ticketId);
        fnbReq2.input('fnbId', sql.Int, item.fnbId);
        fnbReq2.input('quantity', sql.Int, item.quantity);
        await fnbReq2.query(`
          INSERT INTO Ticket_FnB (TicketID, FnBID, Quantity)
          VALUES (@ticketId, @fnbId, @quantity)
        `);
      }
    }

    // --- Tăng usedCount của voucher ---
    if (voucherId) {
      const vuReq = transaction.request();
      vuReq.input('voucherId', sql.Int, voucherId);
      await vuReq.query('UPDATE Vouchers SET UsedCount = UsedCount + 1 WHERE VoucherID = @voucherId');
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Đặt vé thành công!',
      data: {
        ticketIds: createdTickets,
        totalSeats: seatIds.length,
        ticketPrice,
        fnbTotal,
        discountAmount,
        finalAmount,
        paymentMethod,
        status: 'pending',
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error('[bookingController] createBooking:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo vé.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/bookings/my-bookings
//  Lịch sử đặt vé của user hiện tại
// ─────────────────────────────────────────────────────────────
exports.getMyBookings = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT t.TicketID, t.BookedAt, t.Status, t.TotalAmount, t.PaymentMethod,
               m.Title AS MovieTitle, m.PosterURL,
               st.StartTime, st.EndTime,
               r.RoomName,
               c.CinemaName,
               s.SeatRow, s.SeatNumber, s.SeatType,
               v.Code AS VoucherCode
        FROM   Tickets t
        JOIN   Showtimes st ON t.ShowtimeID = st.ShowtimeID
        JOIN   Movies    m  ON st.MovieID   = m.MovieID
        JOIN   Rooms     r  ON st.RoomID    = r.RoomID
        JOIN   Cinemas   c  ON r.CinemaID   = c.CinemaID
        JOIN   Seats     s  ON t.SeatID     = s.SeatID
        LEFT   JOIN Vouchers v ON t.VoucherID = v.VoucherID
        WHERE  t.UserID = @userId
        ORDER BY t.BookedAt DESC
      `);
    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    console.error('[bookingController] getMyBookings:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/bookings/:ticketId
//  Chi tiết một vé (chỉ xem được vé của chính mình hoặc Staff+)
// ─────────────────────────────────────────────────────────────
exports.getBookingDetail = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('ticketId', sql.Int, parseInt(req.params.ticketId))
      .query(`
        SELECT t.TicketID, t.UserID, t.BookedAt, t.Status, t.TicketPrice,
               t.TotalAmount, t.PaymentMethod, t.QRCode,
               m.Title AS MovieTitle, m.PosterURL, m.Duration,
               st.StartTime, st.EndTime,
               r.RoomName,
               c.CinemaName, c.Address,
               s.SeatRow, s.SeatNumber, s.SeatType,
               v.Code AS VoucherCode
        FROM   Tickets t
        JOIN   Showtimes st ON t.ShowtimeID = st.ShowtimeID
        JOIN   Movies    m  ON st.MovieID   = m.MovieID
        JOIN   Rooms     r  ON st.RoomID    = r.RoomID
        JOIN   Cinemas   c  ON r.CinemaID   = c.CinemaID
        JOIN   Seats     s  ON t.SeatID     = s.SeatID
        LEFT   JOIN Vouchers v ON t.VoucherID = v.VoucherID
        WHERE  t.TicketID = @ticketId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vé.' });
    }

    const ticket = result.recordset[0];

    // Kiểm tra quyền: chỉ được xem vé của chính mình (trừ Staff/Admin)
    const allowedRoles = ['Admin', 'Manager', 'Staff'];
    if (!allowedRoles.includes(req.user.role) && ticket.UserID !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem vé này.' });
    }

    // Lấy thêm F&B
    const fnbResult = await pool.request()
      .input('ticketId', sql.Int, parseInt(req.params.ticketId))
      .query(`
        SELECT fb.Name, fb.Category, tf.Quantity, fb.Price,
               (tf.Quantity * fb.Price) AS SubTotal
        FROM   Ticket_FnB tf
        JOIN   FoodBeverages fb ON tf.FnBID = fb.FnBID
        WHERE  tf.TicketID = @ticketId
      `);

    res.json({
      success: true,
      data: { ...ticket, foodItems: fnbResult.recordset },
    });
  } catch (err) {
    console.error('[bookingController] getBookingDetail:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

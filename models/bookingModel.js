const { sql, getPool } = require('../config/db');

class BookingModel {
  static async getFoodBeverages() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT FnBID, Name, Description, Category, Price, ImageURL, IsAvailable
      FROM   FoodBeverages
      WHERE  IsAvailable = 1
      ORDER BY Category, Name
    `);
    return result.recordset;
  }

  static async validateVoucher(code) {
    const pool = await getPool();
    const result = await pool.request()
      .input('code', sql.NVarChar, code)
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
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async createBooking(userId, { showtimeId, seatIds, foodItems, voucherCode, paymentMethod }) {
    const pool = await getPool();
    const transaction = pool.transaction();

    await transaction.begin();

    try {
      const req2 = transaction.request();

      // --- Lấy giá vé từ showtime ---
      req2.input('showtimeId', sql.Int, showtimeId);
      const stResult = await req2.query('SELECT Price FROM Showtimes WHERE ShowtimeID = @showtimeId AND Status = \'active\'');
      if (stResult.recordset.length === 0) {
        throw new Error('Suất chiếu không tồn tại hoặc đã đóng.');
      }
      const ticketPrice = stResult.recordset[0].Price;

      // --- Kiểm tra ghế chưa bị đặt & Tính giá trị từng ghế ---
      let ticketTotal = 0;
      const seatPriceDetails = [];

      for (const seatId of seatIds) {
        const seatReq = transaction.request();
        seatReq.input('sid', sql.Int, seatId);
        seatReq.input('stid', sql.Int, showtimeId);
        const seatCheck = await seatReq.query(`
          SELECT TicketID FROM Tickets
          WHERE SeatID = @sid AND ShowtimeID = @stid AND Status IN ('confirmed','pending')
        `);
        if (seatCheck.recordset.length > 0) {
          throw new Error(`Ghế ID ${seatId} đã được đặt.`);
        }

        const infoReq = transaction.request();
        infoReq.input('sid', sql.Int, seatId);
        const seatInfo = await infoReq.query(`
          SELECT SeatRow, SeatType, PriceMultiplier FROM Seats WHERE SeatID = @sid
        `);
        if (seatInfo.recordset.length === 0) {
          throw new Error(`Ghế ID ${seatId} không tồn tại.`);
        }

        const seat = seatInfo.recordset[0];
        let multiplier = parseFloat(seat.PriceMultiplier || 1.0);
        
        // Dynamically treat Row F as Couple seats and apply 1.5 multiplier (per seat)
        if (seat.SeatRow === 'F') {
          multiplier = 1.5;
        } else if (seat.SeatType === 'VIP') {
          multiplier = 1.2;
        } else {
          multiplier = 1.0;
        }

        const seatPrice = ticketPrice * multiplier;
        ticketTotal += seatPrice;
        seatPriceDetails.push({ seatId, price: seatPrice });
      }

      let totalAmount = ticketTotal;

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
        const seatDetail = seatPriceDetails.find(d => d.seatId === seatId);
        const currentSeatPrice = seatDetail.price;
        
        // Phân bổ giá sau giảm giá theo tỉ lệ giá gốc của ghế
        const ticketFinalTotal = Math.max(0, finalAmount - fnbTotal);
        const discountRatio = ticketTotal > 0 ? (currentSeatPrice / ticketTotal) : 0;
        const currentSeatTotalAmount = ticketFinalTotal * discountRatio;

        const tReq = transaction.request();
        tReq.input('userId', sql.Int, userId);
        tReq.input('showtimeId', sql.Int, showtimeId);
        tReq.input('seatId', sql.Int, seatId);
        tReq.input('voucherId', sql.Int, voucherId);
        tReq.input('ticketPrice', sql.Decimal, currentSeatPrice);
        tReq.input('totalAmount', sql.Decimal, currentSeatTotalAmount);
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

      return {
        ticketIds: createdTickets,
        totalSeats: seatIds.length,
        ticketPrice,
        fnbTotal,
        discountAmount,
        finalAmount,
        paymentMethod,
        status: 'pending',
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async getMyBookings(userId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
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
    return result.recordset;
  }

  static async getBookingDetail(ticketId) {
    const pool = await getPool();
    
    // Ticket info
    const result = await pool.request()
      .input('ticketId', sql.Int, ticketId)
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

    if (result.recordset.length === 0) return null;
    const ticket = result.recordset[0];

    // F&B info
    const fnbResult = await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .query(`
        SELECT fb.Name, fb.Category, tf.Quantity, fb.Price,
               (tf.Quantity * fb.Price) AS SubTotal
        FROM   Ticket_FnB tf
        JOIN   FoodBeverages fb ON tf.FnBID = fb.FnBID
        WHERE  tf.TicketID = @ticketId
      `);

    return { ...ticket, foodItems: fnbResult.recordset };
  }
}

module.exports = BookingModel;

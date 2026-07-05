const { sql, getPool } = require('../config/db');

class StaffModel {
  static async getTodayShowtimes() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT st.ShowtimeID, st.StartTime, st.EndTime, st.Price, st.Status,
             m.Title AS MovieTitle, m.Duration,
             r.RoomName, r.RoomType,
             c.CinemaName
      FROM   Showtimes st
      JOIN   Movies  m ON st.MovieID = m.MovieID
      JOIN   Rooms   r ON st.RoomID  = r.RoomID
      JOIN   Cinemas c ON r.CinemaID = c.CinemaID
      WHERE  CAST(st.StartTime AS DATE) = CAST(GETDATE() AS DATE)
        AND  st.Status = 'active'
      ORDER BY st.StartTime ASC
    `);
    return result.recordset;
  }

  static async sellTicketAtCounter(staffId, { showtimeId, seatIds, foodItems, customerPhone, voucherCode, paymentMethod }) {
    const pool = await getPool();
    const transaction = pool.transaction();

    await transaction.begin();

    try {
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
        throw new Error('Suất chiếu không tồn tại.');
      }
      const ticketPrice = stResult.recordset[0].Price;

      // --- Kiểm tra ghế còn trống và tính tiền ---
      let ticketTotal = 0;
      const couplePairsCharged = new Set();
      
      for (const seatId of seatIds) {
        const sReq = transaction.request();
        sReq.input('seatId', sql.Int, seatId);
        sReq.input('showtimeId', sql.Int, showtimeId);
        const sCheck = await sReq.query(`
          SELECT s.SeatRow, s.SeatNumber, s.SeatType, s.PriceMultiplier, t.TicketID 
          FROM Seats s WITH (UPDLOCK)
          LEFT JOIN Tickets t WITH (UPDLOCK) ON t.SeatID = s.SeatID AND t.ShowtimeID = @showtimeId AND t.Status IN ('confirmed','pending')
          WHERE s.SeatID = @seatId
        `);
        if (sCheck.recordset.length === 0) {
          throw new Error(`Ghế ID ${seatId} không tồn tại.`);
        }
        if (sCheck.recordset[0].TicketID) {
          throw new Error(`Ghế ID ${seatId} đã được đặt.`);
        }
        
        const seat = sCheck.recordset[0];
        let seatPrice;
        if (seat.SeatType && seat.SeatType.toLowerCase().includes('couple')) {
           const pairNum = seat.SeatNumber % 2 === 0 ? seat.SeatNumber - 1 : seat.SeatNumber + 1;
           const pairKey = `${seat.SeatRow}_${Math.min(seat.SeatNumber, pairNum)}`;
           const halfMult = parseFloat(seat.PriceMultiplier || 1.5) / 2;
           if (!couplePairsCharged.has(pairKey)) {
             couplePairsCharged.add(pairKey);
             seatPrice = ticketPrice * halfMult;
           } else {
             seatPrice = ticketPrice * halfMult;
           }
        } else if (seat.SeatType === 'VIP') {
           seatPrice = ticketPrice * parseFloat(seat.PriceMultiplier || 1.2);
        } else {
           seatPrice = ticketPrice * parseFloat(seat.PriceMultiplier || 1.0);
        }
        ticketTotal += seatPrice;
      }

      // --- Tính F&B ---
      let fnbTotal = 0;
      for (const item of foodItems) {
        const fReq = transaction.request();
        fReq.input('fnbId', sql.Int, item.fnbId);
        const fResult = await fReq.query('SELECT Price FROM FoodBeverages WITH (UPDLOCK) WHERE FnBID = @fnbId AND IsAvailable = 1');
        if (fResult.recordset.length > 0) {
          fnbTotal += fResult.recordset[0].Price * item.quantity;
        }
      }

      let totalAmount = ticketTotal + fnbTotal;

      // --- Voucher ---
      let voucherId = null;
      let discountAmount = 0;
      if (voucherCode) {
        const vReq = transaction.request();
        vReq.input('code', sql.NVarChar, voucherCode.trim().toUpperCase());
        const vResult = await vReq.query(`
          SELECT VoucherID, DiscountType, DiscountValue, MaxDiscount, MinOrderValue
          FROM Vouchers WITH (UPDLOCK) 
          WHERE Code = @code AND IsActive = 1
            AND StartDate <= GETUTCDATE() AND EndDate >= GETUTCDATE()
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
        tReq.input('soldBy',        sql.Int,      staffId); // Staff ID

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
        const vuResult = await vuReq.query('UPDATE Vouchers SET UsedCount = UsedCount + 1 WHERE VoucherID = @voucherId AND (UsageLimit IS NULL OR UsedCount < UsageLimit)');
        if (vuResult.rowsAffected[0] === 0) {
           throw new Error('Voucher đã hết lượt sử dụng.');
        }
      }

      await transaction.commit();

      return {
        ticketIds:     createdTickets,
        totalSeats:    seatIds.length,
        ticketPrice,
        fnbTotal,
        discountAmount,
        finalAmount,
        paymentMethod,
        status:        'confirmed',
        soldBy:        staffId,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async getTicketForCheck(ticketId, qrCode) {
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
             r.RoomName, r.RoomType,
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

    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  static async markTicketAsUsed(ticketId) {
    const pool = await getPool();
    await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .query(`
        UPDATE Tickets
        SET Status = 'used', CheckedAt = GETDATE()
        WHERE TicketID = @ticketId
      `);
  }
}

module.exports = StaffModel;

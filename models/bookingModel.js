const { sql, getPool } = require('../config/db');

function isCoupleSeat(seat) {
  return seat.SeatType && seat.SeatType.toLowerCase().includes('couple');
}

function getSeatMultiplier(seat) {
  if (isCoupleSeat(seat)) return parseFloat(seat.PriceMultiplier || 1.5) / 2;
  if (seat.SeatType === 'VIP') return parseFloat(seat.PriceMultiplier || 1.2);
  return parseFloat(seat.PriceMultiplier || 1.0);
}

function couplePairKey(seat) {
  const pairNum = seat.SeatNumber % 2 === 0 ? seat.SeatNumber - 1 : seat.SeatNumber + 1;
  return `${seat.SeatRow}_${Math.min(seat.SeatNumber, pairNum)}`;
}

class BookingModel {
  static async getFoodBeverages() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT FnBID, Name, Description, Category, Price, Stock, ImageURL, IsAvailable
      FROM   FoodBeverages
      WHERE  IsAvailable = 1
      ORDER BY Category, Name
    `);
    return result.recordset;
  }

  static async getActiveVouchers() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT VoucherID, Code, DiscountType, DiscountValue, MinOrderValue,
             MaxDiscount, StartDate, EndDate
      FROM   Vouchers
      WHERE  IsActive = 1
        AND  StartDate <= GETDATE()
        AND  EndDate   >= GETDATE()
        AND  (UsageLimit IS NULL OR UsedCount < UsageLimit)
      ORDER BY EndDate ASC
    `);
    return result.recordset;
  }

  static async validateVoucher(code, userId) {
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
    if (result.recordset.length === 0) return null;
    const voucher = result.recordset[0];

    if (userId) {
      const checkUsed = await pool.request()
        .input('userId', sql.Int, userId)
        .input('voucherId', sql.Int, voucher.VoucherID)
        .query(`
          SELECT COUNT(*) as cnt 
          FROM Tickets 
          WHERE UserID = @userId 
            AND VoucherID = @voucherId 
            AND Status IN ('confirmed', 'used', 'pending')
        `);
      if (checkUsed.recordset[0].cnt > 0) {
        voucher.alreadyUsed = true;
      }
    }
    return voucher;
  }

  static async createBooking(userId, { showtimeId, seatIds, foodItems, voucherCode, paymentMethod }) {
    // Tự động dọn dẹp các vé pending hết hạn trước khi đặt ghế mới
    await BookingModel.cleanupExpiredPendingBookings();

    // Validate payment method
    const allowedMethods = ['qrpay', 'momo'];
    if (!allowedMethods.includes(paymentMethod)) {
      throw new Error(`Phương thức thanh toán "${paymentMethod}" không được hỗ trợ. Chỉ chấp nhận: qrpay, momo.`);
    }
    const pool = await getPool();
    const transaction = pool.transaction();

    await transaction.begin();

    try {
      const req2 = transaction.request();

      // --- Lấy giá vé từ showtime ---
      req2.input('showtimeId', sql.Int, showtimeId);
      const stResult = await req2.query(`
        SELECT COALESCE(Price, BasePrice, 0) AS Price
        FROM Showtimes
        WHERE ShowtimeID = @showtimeId AND Status = 'active'
      `);
      if (stResult.recordset.length === 0) {
        throw new Error('Suất chiếu không tồn tại hoặc đã đóng.');
      }
      const ticketPrice = stResult.recordset[0].Price;
      if (!ticketPrice || ticketPrice <= 0) {
        throw new Error('Suất chiếu chưa được thiết lập giá vé.');
      }

      // --- Kiểm tra ghế chưa bị đặt & Tính giá trị từng ghế ---
      let ticketTotal = 0;
      const seatPriceDetails = [];
      const couplePairsCharged = new Set();

      for (const seatId of seatIds) {
        // Kiểm tra ghế đã được đặt chưa bằng LOCK
        const seatCheckReq = transaction.request();
        seatCheckReq.input('sid', sql.Int, seatId);
        seatCheckReq.input('stid', sql.Int, showtimeId);
        const seatCheck = await seatCheckReq.query(`SELECT TicketID FROM Tickets WITH (UPDLOCK) WHERE SeatID = @sid AND ShowtimeID = @stid AND Status IN ('confirmed','pending')`);
        if (seatCheck.recordset.length > 0) {
          throw new Error(`Ghế ID ${seatId} đã được đặt.`);
        }

        const seatReq = transaction.request();
        seatReq.input('sid', sql.Int, seatId);
        const seatInfo = await seatReq.query(`SELECT SeatRow, SeatNumber, SeatType, PriceMultiplier FROM Seats WHERE SeatID = @sid`);
        if (seatInfo.recordset.length === 0) {
          throw new Error(`Ghế ID ${seatId} không tồn tại.`);
        }

        const seat = seatInfo.recordset[0];
        let seatPrice;

        if (isCoupleSeat(seat)) {
          const pairKey = couplePairKey(seat);
          const halfMult = parseFloat(seat.PriceMultiplier || 1.5) / 2;
          if (!couplePairsCharged.has(pairKey)) {
            couplePairsCharged.add(pairKey);
            seatPrice = ticketPrice * halfMult;
          } else {
            seatPrice = ticketPrice * halfMult;
          }
        } else {
          seatPrice = ticketPrice * getSeatMultiplier(seat);
        }

        ticketTotal += seatPrice;
        seatPriceDetails.push({ seatId, price: seatPrice });
      }

      let totalAmount = ticketTotal;

      // --- Cộng thêm F&B ---
      let fnbTotal = 0;
      for (const item of foodItems) {
        if (!item.quantity || parseInt(item.quantity) <= 0) {
          throw new Error('Số lượng sản phẩm không hợp lệ.');
        }
        const fnbReq = transaction.request();
        fnbReq.input('fnbId', sql.Int, item.fnbId);
        const fnbResult = await fnbReq.query('SELECT Name, Price, Stock FROM FoodBeverages WITH (UPDLOCK) WHERE FnBID = @fnbId AND IsActive = 1');
        if (fnbResult.recordset.length === 0) {
          throw new Error(`Sản phẩm đồ ăn ID ${item.fnbId} không tồn tại hoặc đã ngừng bán.`);
        }
        const fnbItem = fnbResult.recordset[0];
        const qty = parseInt(item.quantity);
        if (qty > 10) {
          throw new Error(`Bạn chỉ được đặt tối đa 10 phần cho mỗi món "${fnbItem.Name}".`);
        }
        if (fnbItem.Stock < qty) {
          throw new Error(`Món "${fnbItem.Name}" chỉ còn lại ${fnbItem.Stock} phần, không đủ số lượng bạn yêu cầu.`);
        }
        fnbTotal += fnbItem.Price * qty;

        // Giảm tồn kho thực tế (đã lock nên an toàn)
        const updateFnbReq = transaction.request();
        updateFnbReq.input('fnbId', sql.Int, item.fnbId);
        updateFnbReq.input('qty', sql.Int, item.quantity);
        const updateRes = await updateFnbReq.query('UPDATE FoodBeverages SET Stock = Stock - @qty WHERE FnBID = @fnbId AND Stock >= @qty');
        if (updateRes.rowsAffected[0] === 0) {
           throw new Error(`Lỗi cập nhật số lượng món "${fnbItem.Name}". Vui lòng thử lại.`);
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
          FROM Vouchers WITH (UPDLOCK) 
          WHERE Code = @code AND IsActive = 1
            AND StartDate <= GETUTCDATE() AND EndDate >= GETUTCDATE()
            AND (UsageLimit IS NULL OR UsedCount < UsageLimit)
        `);
        if (vResult.recordset.length > 0) {
          const v = vResult.recordset[0];
          
          // Check if this user has already used this voucher
          const checkUsedReq = transaction.request();
          checkUsedReq.input('userId', sql.Int, userId);
          checkUsedReq.input('voucherId', sql.Int, v.VoucherID);
          const checkUsedResult = await checkUsedReq.query(`
            SELECT COUNT(*) as cnt 
            FROM Tickets 
            WHERE UserID = @userId 
              AND VoucherID = @voucherId 
              AND Status IN ('confirmed', 'used', 'pending')
          `);
          if (checkUsedResult.recordset[0].cnt > 0) {
            throw new Error('Bạn đã sử dụng voucher này rồi. Mỗi khách hàng chỉ được sử dụng mã này 1 lần.');
          }

          voucherId = v.VoucherID;
          if (totalAmount >= (v.MinOrderValue || 0)) {
            discountAmount = v.DiscountType === 'percent'
              ? Math.min(totalAmount * v.DiscountValue / 100, v.MaxDiscount || Infinity)
              : Math.min(v.DiscountValue, totalAmount);
          }
        }
      }

      const finalAmount = totalAmount - discountAmount;

      // --- Tạo Ticket cho mỗi ghế ở trạng thái PENDING ---
      const createdTickets = [];
      for (let i = 0; i < seatIds.length; i++) {
        const seatId = seatIds[i];
        const seatDetail = seatPriceDetails.find(d => d.seatId === seatId);
        const currentSeatPrice = seatDetail.price;
        
        const ticketFinalTotal = Math.max(0, finalAmount - fnbTotal);
        const discountRatio = ticketTotal > 0 ? (currentSeatPrice / ticketTotal) : 0;
        const currentSeatTotalAmount = ticketFinalTotal * discountRatio;
        const qrCode = `DC-${showtimeId}-${seatId}-${Date.now()}`;

        const tReq = transaction.request();
        tReq.input('userId', sql.Int, userId);
        tReq.input('showtimeId', sql.Int, showtimeId);
        tReq.input('seatId', sql.Int, seatId);
        tReq.input('voucherId', sql.Int, voucherId);
        tReq.input('ticketPrice', sql.Decimal, currentSeatPrice);
        tReq.input('totalAmount', sql.Decimal, currentSeatTotalAmount);
        tReq.input('paymentMethod', sql.NVarChar, paymentMethod);
        tReq.input('qrCode', sql.NVarChar, qrCode);

        const tResult = await tReq.query(`
          INSERT INTO Tickets (UserID, ShowtimeID, SeatID, VoucherID, TicketPrice,
                               TotalAmount, PaymentMethod, Status, BookedAt, QRCode)
          OUTPUT INSERTED.TicketID
          VALUES (@userId, @showtimeId, @seatId, @voucherId, @ticketPrice,
                  @totalAmount, @paymentMethod, 'pending', GETDATE(), @qrCode)
        `);
        const ticketId = tResult.recordset[0].TicketID;
        createdTickets.push({ ticketId, qrCode });

        // --- Thêm F&B chỉ vào vé đầu tiên ---
        if (i === 0) {
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
      }

      // --- Tăng usedCount của voucher ---
      if (voucherId) {
        const vuReq = transaction.request();
        vuReq.input('voucherId', sql.Int, voucherId);
        const updateVoucher = await vuReq.query('UPDATE Vouchers SET UsedCount = UsedCount + 1 WHERE VoucherID = @voucherId AND (UsageLimit IS NULL OR UsedCount < UsageLimit)');
        if (updateVoucher.rowsAffected[0] === 0) {
           throw new Error('Voucher đã hết lượt sử dụng trong khi xử lý giao dịch.');
        }
      }

      await transaction.commit();

      return {
        ticketIds: createdTickets.map(t => t.ticketId),
        qrCodes: createdTickets.map(t => t.qrCode),
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

  static async confirmBooking(ticketIds) {
    const pool = await getPool();
    const ticketIdList = ticketIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (ticketIdList.length === 0) return;
    
    await pool.request().query(`
      UPDATE Tickets
      SET Status = 'confirmed'
      WHERE TicketID IN (${ticketIdList.join(',')}) AND Status = 'pending'
    `);
  }

  static async getBookingTotalAmount(ticketIds) {
    const pool = await getPool();
    const ticketIdList = ticketIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (ticketIdList.length === 0) return 0;

    const ticketsResult = await pool.request().query(`
      SELECT SUM(TotalAmount) AS TicketSum FROM Tickets WHERE TicketID IN (${ticketIdList.join(',')})
    `);
    
    const fnbResult = await pool.request().query(`
      SELECT SUM(tf.Quantity * fb.Price) AS FnBSum
      FROM Ticket_FnB tf
      JOIN FoodBeverages fb ON tf.FnBID = fb.FnBID
      WHERE tf.TicketID IN (${ticketIdList.join(',')})
    `);

    const ticketSum = parseFloat(ticketsResult.recordset[0].TicketSum || 0);
    const fnbSum = parseFloat(fnbResult.recordset[0].FnBSum || 0);

    return ticketSum + fnbSum;
  }

  static async confirmBookingWithTransaction(ticketIds, transactionDetails) {
    const pool = await getPool();
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      // 1. Kiểm tra xem giao dịch đã tồn tại chưa để tránh trùng lặp (Idempotency)
      const checkTxReq = transaction.request();
      checkTxReq.input('refNo', sql.NVarChar, transactionDetails.referenceNumber);
      const checkTxResult = await checkTxReq.query(`
        SELECT TransactionID FROM PaymentTransactions WHERE ReferenceNumber = @refNo
      `);

      if (checkTxResult.recordset.length > 0) {
        await transaction.rollback();
        const err = new Error(`Giao dịch ${transactionDetails.referenceNumber} đã tồn tại.`);
        err.code = 'DUPLICATE_TRANSACTION';
        throw err;
      }

      // 2. Lưu thông tin giao dịch vào bảng PaymentTransactions
      const insertTxReq = transaction.request();
      insertTxReq.input('gateway', sql.NVarChar, transactionDetails.gateway);
      insertTxReq.input('txDate', sql.DateTime, new Date(transactionDetails.transactionDate));
      insertTxReq.input('accNum', sql.NVarChar, transactionDetails.accountNumber);
      insertTxReq.input('amountIn', sql.Decimal(18, 2), transactionDetails.amountIn);
      insertTxReq.input('refNo', sql.NVarChar, transactionDetails.referenceNumber);
      insertTxReq.input('content', sql.NVarChar, transactionDetails.transactionContent);
      insertTxReq.input('method', sql.NVarChar, transactionDetails.paymentMethod);
      insertTxReq.input('rawData', sql.NVarChar, JSON.stringify(transactionDetails.rawData));

      await insertTxReq.query(`
        INSERT INTO PaymentTransactions (Gateway, TransactionDate, AccountNumber, AmountIn, ReferenceNumber, TransactionContent, PaymentMethod, RawData, CreatedAt)
        VALUES (@gateway, @txDate, @accNum, @amountIn, @refNo, @content, @method, @rawData, GETDATE())
      `);

      // 3. Cập nhật trạng thái vé thành 'confirmed'
      const ticketIdList = ticketIds.map(id => parseInt(id)).filter(id => !isNaN(id));
      const confirmReq = transaction.request();
      await confirmReq.query(`
        UPDATE Tickets
        SET Status = 'confirmed'
        WHERE TicketID IN (${ticketIdList.join(',')}) AND Status = 'pending'
      `);

      await transaction.commit();
      console.log(`[DB Webhook] ✅ Confirm booking successfully for tickets: ${ticketIdList.join(', ')}`);
      return true;
    } catch (err) {
      if (err.code !== 'DUPLICATE_TRANSACTION') {
        try {
          await transaction.rollback();
        } catch (rollbackErr) {
          console.error('[DB] Rollback failed:', rollbackErr.message);
        }
      }
      throw err;
    }
  }


  static async cancelBooking(ticketIds) {
    const pool = await getPool();
    const ticketIdList = ticketIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (ticketIdList.length === 0) return;

    const transaction = pool.transaction();
    await transaction.begin();
    try {
      // 1. Lấy thông tin các vé để hoàn trả voucher
      const ticketsResult = await transaction.request().query(`
        SELECT VoucherID FROM Tickets
        WHERE TicketID IN (${ticketIdList.join(',')}) AND Status = 'pending'
      `);
      const tickets = ticketsResult.recordset;
      if (tickets.length === 0) {
        await transaction.rollback();
        return;
      }

      // 2. Hoàn trả F&B stock
      const fnbItemsResult = await transaction.request().query(`
        SELECT FnBID, Quantity FROM Ticket_FnB
        WHERE TicketID IN (${ticketIdList.join(',')})
      `);
      for (const item of fnbItemsResult.recordset) {
        await transaction.request()
          .input('qty', sql.Int, item.Quantity)
          .input('fnbId', sql.Int, item.FnBID)
          .query('UPDATE FoodBeverages SET Stock = Stock + @qty WHERE FnBID = @fnbId');
      }

      // 3. Hoàn trả lượt dùng voucher
      const voucherIds = tickets.map(t => t.VoucherID).filter(v => v !== null);
      if (voucherIds.length > 0) {
        const uniqueVoucherIds = [...new Set(voucherIds)];
        for (const vId of uniqueVoucherIds) {
          const count = voucherIds.filter(id => id === vId).length;
          await transaction.request()
            .input('vId', sql.Int, vId)
            .input('count', sql.Int, count)
            .query('UPDATE Vouchers SET UsedCount = CASE WHEN UsedCount >= @count THEN UsedCount - @count ELSE 0 END WHERE VoucherID = @vId');
        }
      }

      // 4. Xóa Ticket_FnB và Tickets
      await transaction.request().query(`
        DELETE FROM Ticket_FnB WHERE TicketID IN (${ticketIdList.join(',')});
        DELETE FROM Tickets WHERE TicketID IN (${ticketIdList.join(',')});
      `);

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async checkBookingStatus(ticketIds) {
    const pool = await getPool();
    const ticketIdList = ticketIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (ticketIdList.length === 0) return [];

    const result = await pool.request().query(`
      SELECT TicketID, Status, BookedAt, TotalAmount,
             DATEDIFF(second, BookedAt, GETDATE()) AS SecondsElapsed
      FROM Tickets
      WHERE TicketID IN (${ticketIdList.join(',')})
    `);
    return result.recordset;
  }

  static async cleanupExpiredPendingBookings() {
    const pool = await getPool();
    try {
      // 1. Tìm các vé pending quá 10 phút
      const expiredTicketsResult = await pool.request().query(`
        SELECT TicketID, VoucherID FROM Tickets
        WHERE Status = 'pending' AND DATEDIFF(minute, BookedAt, GETDATE()) >= 10
      `);
      const expiredTickets = expiredTicketsResult.recordset;
      if (expiredTickets.length === 0) return;

      const expiredTicketIds = expiredTickets.map(t => t.TicketID);

      // 2. Hoàn trả tồn kho đồ ăn thức uống
      const fnbItemsResult = await pool.request().query(`
        SELECT FnBID, Quantity FROM Ticket_FnB
        WHERE TicketID IN (${expiredTicketIds.join(',')})
      `);
      for (const item of fnbItemsResult.recordset) {
        await pool.request()
          .input('qty', sql.Int, item.Quantity)
          .input('fnbId', sql.Int, item.FnBID)
          .query('UPDATE FoodBeverages SET Stock = Stock + @qty WHERE FnBID = @fnbId');
      }

      // 3. Hoàn trả voucher
      const voucherIds = expiredTickets.map(t => t.VoucherID).filter(v => v !== null);
      if (voucherIds.length > 0) {
        const uniqueVoucherIds = [...new Set(voucherIds)];
        for (const vId of uniqueVoucherIds) {
          const count = voucherIds.filter(id => id === vId).length;
          await pool.request()
            .input('vId', sql.Int, vId)
            .input('count', sql.Int, count)
            .query('UPDATE Vouchers SET UsedCount = CASE WHEN UsedCount >= @count THEN UsedCount - @count ELSE 0 END WHERE VoucherID = @vId');
        }
      }

      // 4. Xóa liên kết F&B và vé
      await pool.request().query(`
        DELETE FROM Ticket_FnB WHERE TicketID IN (${expiredTicketIds.join(',')});
        DELETE FROM Tickets WHERE TicketID IN (${expiredTicketIds.join(',')});
      `);
      
      console.log(`[DB Cleanup] Đã dọn dẹp ${expiredTicketIds.length} vé pending hết hạn.`);
    } catch (err) {
      console.error('[DB Cleanup] Lỗi dọn dẹp vé pending hết hạn:', err.message);
    }
  }

  static async getPaymentQRImages() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT PaymentMethod, ImagePath, DisplayName, Description,
             AccountName, AccountNumber, BankName, BankCode, IsActive
      FROM   PaymentQRImages
      WHERE  IsActive = 1
      ORDER  BY QRImageID ASC
    `);
    return result.recordset;
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

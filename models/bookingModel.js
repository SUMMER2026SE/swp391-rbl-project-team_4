const { sql, getPool } = require('../config/db');

const SettingsModel = require('./settingsModel');
const RewardModel = require('./rewardModel');
const RefundModel = require('./refundModel');

function isCoupleSeat(seat) {
  return seat.SeatType && seat.SeatType.toLowerCase().includes('couple');
}

function getSeatMultiplier(seat) {
  if (seat.PriceMultiplier && parseFloat(seat.PriceMultiplier) !== 1.0) {
    return parseFloat(seat.PriceMultiplier);
  }
  if (isCoupleSeat(seat)) return parseFloat(SettingsModel.cache['COUPLE_MULTIPLIER']) || 1.5;
  if (seat.SeatType === 'VIP') return parseFloat(SettingsModel.cache['VIP_MULTIPLIER']) || 1.2;
  return 1.0;
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
      SELECT v.VoucherID, v.VoucherCode AS Code, v.VoucherName, v.VoucherType,
             v.DiscountType, v.DiscountValue, v.MinimumOrder AS MinOrderValue,
             v.MaximumDiscount AS MaxDiscount, v.StartDate, v.EndDate,
             v.Description, v.ImageUrl
      FROM   Voucher v
      WHERE  v.Status = 'Active'
        AND  v.StartDate <= GETDATE()
        AND  v.EndDate   >= GETDATE()
        AND  (v.UsageLimit IS NULL OR v.UsageLimit = 0 OR v.UsedCount < v.UsageLimit)
      ORDER BY v.EndDate ASC
    `);
    return result.recordset;
  }

  static async validateVoucher(code, userId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('code', sql.NVarChar, code)
      .query(`
        SELECT v.VoucherID, v.Code, v.DiscountType, v.DiscountValue,
               v.MinOrderValue, v.MaxDiscount, v.UsageLimit, v.UsedCount,
               v.StartDate, v.EndDate, v.IsActive,
               uv.UserID AS OwnerUserID, uv.IsUsed AS UserVoucherUsed
        FROM   Vouchers v
        LEFT JOIN UserVouchers uv ON v.VoucherID = uv.VoucherID
        WHERE  v.Code = @code
          AND  v.IsActive = 1
          AND  v.StartDate <= GETDATE()
          AND  v.EndDate   >= GETDATE()
          AND  (v.UsageLimit IS NULL OR v.UsedCount < v.UsageLimit)
      `);
    if (result.recordset.length === 0) return null;
    const voucher = result.recordset[0];

    if (voucher.OwnerUserID && (!userId || voucher.OwnerUserID !== parseInt(userId, 10))) {
      voucher.notOwned = true;
      return voucher;
    }

    if (voucher.OwnerUserID && voucher.UserVoucherUsed) {
      voucher.alreadyUsed = true;
      return voucher;
    }

    if (userId) {
      const checkUsed = await pool.request()
        .input('userId', sql.Int, userId)
        .input('voucherId', sql.Int, voucher.VoucherID)
        .query(`
          SELECT COUNT(*) as cnt 
          FROM Tickets 
          WHERE UserID = @userId 
            AND VoucherID = @voucherId 
            AND Status IN ('confirmed', 'used', 'pending', 'refund_requested')
        `);
      if (checkUsed.recordset[0].cnt > 0) {
        voucher.alreadyUsed = true;
      }
    }
    return voucher;
  }

  static async createBooking(userId, { showtimeId, seatIds, foodItems, voucherCode, paymentMethod, sessionId }) {
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
        const seatCheck = await seatCheckReq.query(`SELECT TicketID FROM Tickets WITH (UPDLOCK) WHERE SeatID = @sid AND ShowtimeID = @stid AND Status IN ('confirmed','pending','refund_requested')`);
        if (seatCheck.recordset.length > 0) {
          throw new Error(`Ghế ID ${seatId} đã được đặt.`);
        }

        // Kiểm tra xem ghế có đang bị khóa bởi session khác không
        if (sessionId) {
          const lockCheckReq = transaction.request();
          lockCheckReq.input('sid', sql.Int, seatId);
          lockCheckReq.input('stid', sql.Int, showtimeId);
          const lockCheck = await lockCheckReq.query(`SELECT SessionID FROM SeatLocks WITH (UPDLOCK) WHERE SeatID = @sid AND ShowtimeID = @stid AND ExpiresAt > GETDATE()`);
          if (lockCheck.recordset.length > 0) {
            const lockSessionId = lockCheck.recordset[0].SessionID;
            if (lockSessionId !== sessionId) {
               throw new Error(`Ghế ID ${seatId} đã bị người khác chọn.`);
            }
          }
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
        const fnbResult = await fnbReq.query('SELECT Name, Price, Stock FROM FoodBeverages WITH (UPDLOCK) WHERE FnBID = @fnbId AND IsAvailable = 1');
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
          SELECT v.VoucherID, v.DiscountType, v.DiscountValue, v.MaxDiscount, v.MinOrderValue,
                 uv.UserID AS OwnerUserID, uv.IsUsed AS UserVoucherUsed
          FROM Vouchers v WITH (UPDLOCK)
          LEFT JOIN UserVouchers uv ON v.VoucherID = uv.VoucherID
          WHERE v.Code = @code AND v.IsActive = 1
            AND v.StartDate <= GETUTCDATE() AND v.EndDate >= GETUTCDATE()
            AND (v.UsageLimit IS NULL OR v.UsedCount < v.UsageLimit)
        `);
        if (vResult.recordset.length > 0) {
          const v = vResult.recordset[0];

          if (v.OwnerUserID && v.OwnerUserID !== parseInt(userId, 10)) {
            throw new Error('Voucher này thuộc tài khoản khác.');
          }

          if (v.OwnerUserID && v.UserVoucherUsed) {
            throw new Error('Voucher đổi điểm này đã được sử dụng.');
          }
          
          // Check if this user has already used this voucher
          const checkUsedReq = transaction.request();
          checkUsedReq.input('userId', sql.Int, userId);
          checkUsedReq.input('voucherId', sql.Int, v.VoucherID);
          const checkUsedResult = await checkUsedReq.query(`
            SELECT COUNT(*) as cnt 
            FROM Tickets 
            WHERE UserID = @userId 
              AND VoucherID = @voucherId 
              AND Status IN ('confirmed', 'used', 'pending', 'refund_requested')
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

        await transaction.request()
          .input('voucherId', sql.Int, voucherId)
          .input('userId', sql.Int, userId)
          .query(`
            UPDATE UserVouchers
            SET IsUsed = 1,
                UsedAt = GETDATE()
            WHERE VoucherID = @voucherId
              AND UserID = @userId
              AND IsUsed = 0
          `);
      }

      // Xóa locks của session hiện tại cho những ghế đã mua thành công
      if (sessionId) {
          const delLockReq = transaction.request();
          delLockReq.input('stid', sql.Int, showtimeId);
          delLockReq.input('sessId', sql.NVarChar, sessionId);
          await delLockReq.query(`
            DELETE FROM SeatLocks 
            WHERE ShowtimeID = @stid AND SessionID = @sessId AND SeatID IN (${seatIds.map(id => parseInt(id)).join(',')})
          `);
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

      const awardedPoints = await RewardModel.awardPointsForTickets(transaction, ticketIdList);

      await transaction.commit();
      console.log(`[DB Webhook] ✅ Confirm booking successfully for tickets: ${ticketIdList.join(', ')}`);
      if (awardedPoints.length > 0) {
        console.log(`[Rewards] Awarded points: ${awardedPoints.map(p => `ticket ${p.ticketId} +${p.points}`).join(', ')}`);
      }
      return { success: true, awardedPoints };
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
        SELECT TicketID, UserID, VoucherID, ShowtimeID, SeatID FROM Tickets
        WHERE TicketID IN (${ticketIdList.join(',')}) AND Status = 'pending'
      `);
      const tickets = ticketsResult.recordset;
      if (tickets.length === 0) {
        await transaction.rollback();
        return [];
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

        for (const ticket of tickets.filter(t => t.VoucherID !== null && t.UserID !== null)) {
          await transaction.request()
            .input('voucherId', sql.Int, ticket.VoucherID)
            .input('userId', sql.Int, ticket.UserID)
            .query(`
              UPDATE UserVouchers
              SET IsUsed = 0,
                  UsedAt = NULL
              WHERE VoucherID = @voucherId
                AND UserID = @userId
                AND Source = 'reward'
            `);
        }
      }

      // 4. Xóa Ticket_FnB và Tickets
      await transaction.request().query(`
        DELETE FROM Ticket_FnB WHERE TicketID IN (${ticketIdList.join(',')});
        DELETE FROM Tickets WHERE TicketID IN (${ticketIdList.join(',')});
      `);

      await transaction.commit();
      return tickets.map(t => ({ showtimeId: t.ShowtimeID, seatId: t.SeatID }));
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

  static async cancelConfirmedBooking(ticketId, userId, refundInfo = {}) {
    return RefundModel.requestRefund(userId, [ticketId], refundInfo);
  }

  static async requestRefund(userId, ticketIds, refundInfo = {}) {
    return RefundModel.requestRefund(userId, ticketIds, refundInfo);
  }

  static async cancelConfirmedBookingImmediate(ticketId, userId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .input('userId', sql.Int, userId)
      .query(`
        DECLARE @ShowtimeID int;
        DECLARE @Status varchar(20);
        DECLARE @StartTime datetime;
        
        SELECT @ShowtimeID = t.ShowtimeID, @Status = t.Status, @StartTime = st.StartTime
        FROM Tickets t
        JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
        WHERE t.TicketID = @ticketId AND t.UserID = @userId;

        IF @ShowtimeID IS NULL
        BEGIN
            SELECT 'NOT_FOUND' AS ErrorCode, 'Không tìm thấy vé hợp lệ của bạn.' AS Message;
            RETURN;
        END

        IF @Status <> 'confirmed'
        BEGIN
            SELECT 'INVALID_STATUS' AS ErrorCode, 'Chỉ có thể hủy vé đã được xác nhận thanh toán.' AS Message;
            RETURN;
        END

        IF DATEDIFF(minute, GETUTCDATE(), @StartTime) < 120
        BEGIN
            SELECT 'TOO_LATE' AS ErrorCode, 'Chỉ được phép hủy vé trước khi suất chiếu bắt đầu ít nhất 2 giờ.' AS Message;
            RETURN;
        END

        UPDATE Tickets SET Status = 'cancelled' WHERE TicketID = @ticketId;
        SELECT 'SUCCESS' AS ErrorCode, 'Hủy vé thành công.' AS Message;
      `);
      
    const record = result.recordset[0];
    if (record.ErrorCode !== 'SUCCESS') {
      throw new Error(record.Message);
    }
    return true;
  }

  static async cleanupExpiredPendingBookings() {
    const pool = await getPool();
    try {
      // 0. Xóa các khóa ghế đã hết hạn
      await pool.request().query(`DELETE FROM SeatLocks WHERE ExpiresAt <= GETDATE()`);

      // 1. Tìm các vé pending quá 10 phút
      const expiredTicketsResult = await pool.request().query(`
        SELECT TicketID, UserID, VoucherID FROM Tickets
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

        for (const ticket of expiredTickets.filter(t => t.VoucherID !== null && t.UserID !== null)) {
          await pool.request()
            .input('voucherId', sql.Int, ticket.VoucherID)
            .input('userId', sql.Int, ticket.UserID)
            .query(`
              UPDATE UserVouchers
              SET IsUsed = 0,
                  UsedAt = NULL
              WHERE VoucherID = @voucherId
                AND UserID = @userId
                AND Source = 'reward'
            `);
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
    await RefundModel.ensureSchema();
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT t.TicketID, t.BookedAt, t.Status, t.TotalAmount, t.PaymentMethod,
               t.RefundStatus, t.RefundRequestedAt, t.CancelReason, t.CancelledAt, t.RefundedAt,
               m.Title AS MovieTitle, m.PosterURL,
               CONVERT(varchar(19), st.StartTime, 126) AS StartTime,
               CONVERT(varchar(19), st.EndTime, 126) AS EndTime,
               r.RoomName,
               CASE
                 WHEN r.RoomName LIKE '%3D%' THEN '3D'
                 WHEN r.RoomName LIKE '%IMAX%' THEN 'IMAX'
                 ELSE '2D Standard'
               END AS RoomType,
               c.CinemaName,
               s.SeatRow, s.SeatNumber, s.SeatType,
               v.Code AS VoucherCode,
               rr.RefundID, rr.Status AS RefundRequestStatus, rr.Reason AS RefundReason,
               rr.BankName, rr.BankAccountNumber, rr.BankAccountHolder,
               rr.AdminNote, rr.RefundTransactionCode, rr.RequestedAt AS RefundRequestCreatedAt,
               rr.ProcessedAt AS RefundProcessedAt, rr.CompletedAt AS RefundCompletedAt
        FROM   Tickets t
        JOIN   Showtimes st ON t.ShowtimeID = st.ShowtimeID
        JOIN   Movies    m  ON st.MovieID   = m.MovieID
        JOIN   Rooms     r  ON st.RoomID    = r.RoomID
        JOIN   Cinemas   c  ON r.CinemaID   = c.CinemaID
        JOIN   Seats     s  ON t.SeatID     = s.SeatID
        LEFT   JOIN Vouchers v ON t.VoucherID = v.VoucherID
        OUTER APPLY (
          SELECT TOP 1 *
          FROM RefundRequests rr
          WHERE rr.TicketID = t.TicketID
          ORDER BY rr.RequestedAt DESC, rr.RefundID DESC
        ) rr
        WHERE  t.UserID = @userId
        ORDER BY t.BookedAt DESC
      `);
    return result.recordset;
  }

  static async getBookingDetail(ticketId) {
    await RefundModel.ensureSchema();
    const pool = await getPool();
    
    // Ticket info
    const result = await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .query(`
        SELECT t.TicketID, t.UserID, t.BookedAt, t.Status, t.TicketPrice,
               t.TotalAmount, t.PaymentMethod, t.QRCode,
               t.RefundStatus, t.RefundRequestedAt, t.CancelReason, t.CancelledAt, t.RefundedAt,
               m.Title AS MovieTitle, m.PosterURL, m.Duration,
               CONVERT(varchar(19), st.StartTime, 126) AS StartTime,
               CONVERT(varchar(19), st.EndTime, 126) AS EndTime,
               r.RoomName,
               CASE
                 WHEN r.RoomName LIKE '%3D%' THEN '3D'
                 WHEN r.RoomName LIKE '%IMAX%' THEN 'IMAX'
                 ELSE '2D Standard'
               END AS RoomType,
               c.CinemaName, c.Address,
               s.SeatRow, s.SeatNumber, s.SeatType,
               v.Code AS VoucherCode,
               u.Email AS UserEmail, u.FullName AS UserFullName,
               rr.RefundID, rr.Status AS RefundRequestStatus, rr.Reason AS RefundReason,
               rr.BankName, rr.BankAccountNumber, rr.BankAccountHolder,
               rr.AdminNote, rr.RefundTransactionCode, rr.RequestedAt AS RefundRequestCreatedAt,
               rr.ProcessedAt AS RefundProcessedAt, rr.CompletedAt AS RefundCompletedAt
        FROM   Tickets t
        JOIN   Showtimes st ON t.ShowtimeID = st.ShowtimeID
        JOIN   Movies    m  ON st.MovieID   = m.MovieID
        JOIN   Rooms     r  ON st.RoomID    = r.RoomID
        JOIN   Cinemas   c  ON r.CinemaID   = c.CinemaID
        JOIN   Seats     s  ON t.SeatID     = s.SeatID
        LEFT   JOIN Vouchers v ON t.VoucherID = v.VoucherID
        JOIN   Users     u  ON t.UserID     = u.UserID
        OUTER APPLY (
          SELECT TOP 1 *
          FROM RefundRequests rr
          WHERE rr.TicketID = t.TicketID
          ORDER BY rr.RequestedAt DESC, rr.RefundID DESC
        ) rr
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

  static async calculateBookingPrice(userId, { showtimeId, seatIds, foodItems = [], voucherCode = null }) {
    const pool = await getPool();
    
    // 1. Lấy giá vé từ showtime
    const stResult = await pool.request()
      .input('showtimeId', sql.Int, showtimeId)
      .query(`
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

    // 2. Tính tiền ghế
    let ticketTotal = 0;
    const seatPriceDetails = [];
    const couplePairsCharged = new Set();

    for (const seatId of seatIds) {
      const seatInfo = await pool.request()
        .input('sid', sql.Int, seatId)
        .query(`SELECT SeatRow, SeatNumber, SeatType, PriceMultiplier FROM Seats WHERE SeatID = @sid`);
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
      seatPriceDetails.push({ seatId, price: seatPrice, row: seat.SeatRow, number: seat.SeatNumber, type: seat.SeatType });
    }

    // 3. Cộng tiền F&B
    let fnbTotal = 0;
    const fnbDetails = [];
    for (const item of foodItems) {
      if (!item.quantity || parseInt(item.quantity) <= 0) {
        continue;
      }
      const fnbResult = await pool.request()
        .input('fnbId', sql.Int, item.fnbId)
        .query('SELECT Name, Price, Stock FROM FoodBeverages WHERE FnBID = @fnbId AND IsAvailable = 1');
      if (fnbResult.recordset.length === 0) {
        throw new Error(`Sản phẩm đồ ăn ID ${item.fnbId} không tồn tại hoặc đã ngừng bán.`);
      }
      const fnbItem = fnbResult.recordset[0];
      const qty = parseInt(item.quantity);
      const subTotal = fnbItem.Price * qty;
      fnbTotal += subTotal;
      fnbDetails.push({ fnbId: item.fnbId, name: fnbItem.Name, price: fnbItem.Price, quantity: qty, subTotal });
    }

    const totalAmount = ticketTotal + fnbTotal;

    // 4. Áp dụng voucher
    let voucherId = null;
    let discountAmount = 0;
    if (voucherCode) {
      const vResult = await pool.request()
        .input('code', sql.NVarChar, voucherCode.trim().toUpperCase())
        .query(`
          SELECT v.VoucherID, v.Code, v.DiscountType, v.DiscountValue, v.MaxDiscount, v.MinOrderValue,
                 uv.UserID AS OwnerUserID, uv.IsUsed AS UserVoucherUsed
          FROM Vouchers v
          LEFT JOIN UserVouchers uv ON v.VoucherID = uv.VoucherID
          WHERE v.Code = @code AND v.IsActive = 1
            AND v.StartDate <= GETUTCDATE() AND v.EndDate >= GETUTCDATE()
            AND (v.UsageLimit IS NULL OR v.UsedCount < v.UsageLimit)
        `);
      if (vResult.recordset.length > 0) {
        const v = vResult.recordset[0];

        if (v.OwnerUserID && v.OwnerUserID !== parseInt(userId, 10)) {
          throw new Error('Voucher này thuộc tài khoản khác.');
        }

        if (v.OwnerUserID && v.UserVoucherUsed) {
          throw new Error('Voucher đổi điểm này đã được sử dụng.');
        }

        // Check if this user has already used this voucher
        const checkUsedResult = await pool.request()
          .input('userId', sql.Int, userId)
          .input('voucherId', sql.Int, v.VoucherID)
          .query(`
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

    return {
      ticketPrice,
      ticketTotal,
      fnbTotal,
      discountAmount,
      finalAmount,
      seatPriceDetails,
      fnbDetails
    };
  }

  // ==========================================
  // REAL-TIME SEAT LOCKING VIA DB
  // ==========================================

  static async holdSeatDB(showtimeId, seatId, sessionId, socketId, expiryMinutes = 5) {
    const pool = await getPool();
    try {
      const result = await pool.request()
        .input('showtimeId', sql.Int, showtimeId)
        .input('seatId', sql.Int, seatId)
        .input('sessionId', sql.NVarChar, sessionId)
        .input('socketId', sql.NVarChar, socketId)
        .input('expiryMins', sql.Int, expiryMinutes)
        .query(`
          INSERT INTO SeatLocks (ShowtimeID, SeatID, SessionID, SocketID, ExpiresAt)
          VALUES (@showtimeId, @seatId, @sessionId, @socketId, DATEADD(minute, @expiryMins, GETDATE()))
        `);
      return true;
    } catch (err) {
      // 2627 or 2601 is Violation of UNIQUE KEY constraint (already locked)
      if (err.number === 2627 || err.number === 2601) {
        return false; // already locked
      }
      throw err;
    }
  }

  static async releaseSeatDB(showtimeId, seatId, sessionId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('showtimeId', sql.Int, showtimeId)
      .input('seatId', sql.Int, seatId)
      .input('sessionId', sql.NVarChar, sessionId)
      .query(`
        DELETE FROM SeatLocks 
        WHERE ShowtimeID = @showtimeId AND SeatID = @seatId AND SessionID = @sessionId
      `);
    return result.rowsAffected[0] > 0;
  }

  static async reclaimSeatsDB(showtimeId, seatIds, sessionId, newSocketId) {
    if (!seatIds || seatIds.length === 0) return 0;
    const pool = await getPool();
    const seatIdList = seatIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (seatIdList.length === 0) return 0;
    
    const result = await pool.request()
      .input('showtimeId', sql.Int, showtimeId)
      .input('sessionId', sql.NVarChar, sessionId)
      .input('newSocketId', sql.NVarChar, newSocketId)
      .query(`
        UPDATE SeatLocks
        SET SocketID = @newSocketId, ExpiresAt = DATEADD(minute, 5, GETDATE())
        WHERE ShowtimeID = @showtimeId AND SessionID = @sessionId AND SeatID IN (${seatIdList.join(',')})
      `);
    return result.rowsAffected[0];
  }

  static async releaseAllSeatsBySession(sessionId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('sessionId', sql.NVarChar, sessionId)
      .query(`
        -- Lấy ra danh sách ghế sẽ bị xóa để có thể broadcast
        SELECT ShowtimeID, SeatID FROM SeatLocks WHERE SessionID = @sessionId;
        
        DELETE FROM SeatLocks WHERE SessionID = @sessionId;
      `);
    return result.recordset || []; // Trả về danh sách ghế bị giải phóng để emit socket
  }

  static async getLockedSeatsDB(showtimeId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('showtimeId', sql.Int, showtimeId)
      .query(`
        SELECT SeatID, SessionID FROM SeatLocks 
        WHERE ShowtimeID = @showtimeId AND ExpiresAt > GETDATE()
      `);
    return result.recordset || [];
  }
}

module.exports = BookingModel;

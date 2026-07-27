const { sql, getPool } = require('../config/db');

let refundSchemaReady = false;

async function ensureRefundSchema() {
  if (refundSchemaReady) return;
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.RefundRequests', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.RefundRequests (
        RefundID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TicketID INT NOT NULL,
        UserID INT NOT NULL,
        RefundAmount DECIMAL(18,2) NOT NULL,
        Reason NVARCHAR(500) NULL,
        BankName NVARCHAR(100) NOT NULL,
        BankAccountNumber VARCHAR(50) NOT NULL,
        BankAccountHolder NVARCHAR(100) NOT NULL,
        Status VARCHAR(30) NOT NULL CONSTRAINT DF_RefundRequests_Status DEFAULT 'pending',
        AdminNote NVARCHAR(500) NULL,
        RefundTransactionCode VARCHAR(100) NULL,
        RequestedAt DATETIME NOT NULL CONSTRAINT DF_RefundRequests_RequestedAt DEFAULT GETDATE(),
        ProcessedAt DATETIME NULL,
        ProcessedBy INT NULL,
        CompletedAt DATETIME NULL,
        CONSTRAINT FK_RefundRequests_Tickets FOREIGN KEY (TicketID) REFERENCES dbo.Tickets(TicketID),
        CONSTRAINT FK_RefundRequests_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_RefundRequests_ProcessedBy FOREIGN KEY (ProcessedBy) REFERENCES dbo.Users(UserID)
      );
    END;

    IF COL_LENGTH('dbo.RefundRequests', 'BankName') IS NULL
      ALTER TABLE dbo.RefundRequests ADD BankName NVARCHAR(100) NULL;
    IF COL_LENGTH('dbo.RefundRequests', 'BankAccountNumber') IS NULL
      ALTER TABLE dbo.RefundRequests ADD BankAccountNumber VARCHAR(50) NULL;
    IF COL_LENGTH('dbo.RefundRequests', 'BankAccountHolder') IS NULL
      ALTER TABLE dbo.RefundRequests ADD BankAccountHolder NVARCHAR(100) NULL;
    IF COL_LENGTH('dbo.RefundRequests', 'RefundTransactionCode') IS NULL
      ALTER TABLE dbo.RefundRequests ADD RefundTransactionCode VARCHAR(100) NULL;
    IF COL_LENGTH('dbo.RefundRequests', 'CompletedAt') IS NULL
      ALTER TABLE dbo.RefundRequests ADD CompletedAt DATETIME NULL;

    IF COL_LENGTH('dbo.Tickets', 'CancelReason') IS NULL
      ALTER TABLE dbo.Tickets ADD CancelReason NVARCHAR(500) NULL;
    IF COL_LENGTH('dbo.Tickets', 'CancelledAt') IS NULL
      ALTER TABLE dbo.Tickets ADD CancelledAt DATETIME NULL;
    IF COL_LENGTH('dbo.Tickets', 'RefundStatus') IS NULL
      ALTER TABLE dbo.Tickets ADD RefundStatus VARCHAR(30) NULL;
    IF COL_LENGTH('dbo.Tickets', 'RefundedAt') IS NULL
      ALTER TABLE dbo.Tickets ADD RefundedAt DATETIME NULL;
    IF COL_LENGTH('dbo.Tickets', 'RefundRequestedAt') IS NULL
      ALTER TABLE dbo.Tickets ADD RefundRequestedAt DATETIME NULL;

    IF OBJECT_ID('dbo.RewardPointTransactions', 'U') IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM sys.check_constraints
         WHERE parent_object_id = OBJECT_ID('dbo.RewardPointTransactions')
           AND name = 'CK_RewardPointTransactions_Type'
           AND definition NOT LIKE '%adjust%'
       )
    BEGIN
      ALTER TABLE dbo.RewardPointTransactions DROP CONSTRAINT CK_RewardPointTransactions_Type;
      ALTER TABLE dbo.RewardPointTransactions
      ADD CONSTRAINT CK_RewardPointTransactions_Type
      CHECK (TransactionType IN ('earn', 'redeem', 'adjust'));
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'IX_RefundRequests_Status_RequestedAt'
        AND object_id = OBJECT_ID('dbo.RefundRequests')
    )
    BEGIN
      CREATE INDEX IX_RefundRequests_Status_RequestedAt
      ON dbo.RefundRequests (Status, RequestedAt DESC)
      INCLUDE (TicketID, UserID, RefundAmount);
    END;
  `);
  refundSchemaReady = true;
}

function cleanText(value, maxLength) {
  const text = String(value || '').trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function parseTicketIds(ticketIds) {
  const ids = Array.isArray(ticketIds) ? ticketIds : [ticketIds];
  return ids.map(id => parseInt(id, 10)).filter((id, index, arr) => Number.isInteger(id) && id > 0 && arr.indexOf(id) === index);
}

class RefundModel {
  static async ensureSchema() {
    await ensureRefundSchema();
  }

  static async requestRefund(userId, ticketIds, payload = {}) {
    await ensureRefundSchema();
    const ids = parseTicketIds(ticketIds);
    if (ids.length === 0) throw new Error('Danh sách vé không hợp lệ.');

    const reason = cleanText(payload.reason, 500);
    const bankName = cleanText(payload.bankName, 100);
    const bankAccountNumber = cleanText(payload.bankAccountNumber, 50);
    const bankAccountHolder = cleanText(payload.bankAccountHolder, 100);

    if (!reason) throw new Error('Vui lòng nhập lý do hủy vé.');
    if (!bankName || !bankAccountNumber || !bankAccountHolder) {
      throw new Error('Vui lòng nhập đầy đủ thông tin tài khoản nhận hoàn tiền.');
    }

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const idList = ids.join(',');
      const ticketResult = await transaction.request()
        .input('userId', sql.Int, parseInt(userId, 10))
        .query(`
          SELECT t.TicketID, t.UserID, t.Status, t.TotalAmount, t.ShowtimeID, t.VoucherID,
                 t.PointsEarned, t.PointsAwardedAt,
                 st.StartTime, m.Title AS MovieTitle,
                 DATEDIFF(minute, GETUTCDATE(), st.StartTime) AS MinutesToStart
          FROM Tickets t WITH (UPDLOCK)
          JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
          JOIN Movies m ON st.MovieID = m.MovieID
          WHERE t.TicketID IN (${idList}) AND t.UserID = @userId
        `);

      if (ticketResult.recordset.length !== ids.length) {
        throw new Error('Không tìm thấy đủ vé hợp lệ của bạn.');
      }

      const tickets = ticketResult.recordset;
      const invalid = tickets.find(t => t.Status !== 'confirmed');
      if (invalid) throw new Error('Chỉ có thể yêu cầu hoàn tiền cho vé đã thanh toán thành công.');

      const tooLate = tickets.find(t => t.MinutesToStart < 120);
      if (tooLate) throw new Error('Chỉ được phép hủy vé trước khi suất chiếu bắt đầu ít nhất 2 giờ.');

      const existing = await transaction.request().query(`
        SELECT TicketID
        FROM RefundRequests
        WHERE TicketID IN (${idList})
          AND Status IN ('pending', 'approved', 'completed')
      `);
      if (existing.recordset.length > 0) {
        throw new Error('Một hoặc nhiều vé đã có yêu cầu hoàn tiền.');
      }

      const created = [];
      for (const ticket of tickets) {
        const fnbRes = await transaction.request()
          .input('ticketIdFnB', sql.Int, ticket.TicketID)
          .query('SELECT ISNULL(SUM(tf.Quantity * fb.Price), 0) AS FnBSum FROM Ticket_FnB tf JOIN FoodBeverages fb ON tf.FnBID = fb.FnBID WHERE tf.TicketID = @ticketIdFnB');
        const fnbSum = Number(fnbRes.recordset[0]?.FnBSum || 0);
        const refundAmount = Number(ticket.TotalAmount || 0) + fnbSum;

        const insertResult = await transaction.request()
          .input('ticketId', sql.Int, ticket.TicketID)
          .input('userId', sql.Int, parseInt(userId, 10))
          .input('refundAmount', sql.Decimal(18, 2), refundAmount)
          .input('reason', sql.NVarChar(500), reason)
          .input('bankName', sql.NVarChar(100), bankName)
          .input('bankAccountNumber', sql.VarChar(50), bankAccountNumber)
          .input('bankAccountHolder', sql.NVarChar(100), bankAccountHolder)
          .query(`
            INSERT INTO RefundRequests
              (TicketID, UserID, RefundAmount, Reason, BankName, BankAccountNumber, BankAccountHolder, Status)
            OUTPUT INSERTED.*
            VALUES
              (@ticketId, @userId, @refundAmount, @reason, @bankName, @bankAccountNumber, @bankAccountHolder, 'pending');
          `);
        created.push(insertResult.recordset[0]);
      }

      await transaction.request()
        .input('reason', sql.NVarChar(500), reason)
        .query(`
          UPDATE Tickets
          SET Status = 'refund_requested',
              RefundStatus = 'pending',
              RefundRequestedAt = GETDATE(),
              CancelReason = @reason
          WHERE TicketID IN (${idList});
        `);

      await transaction.commit();
      return created;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async getAdminRefunds({ status, search } = {}) {
    await ensureRefundSchema();
    const pool = await getPool();
    const request = pool.request();
    let filters = 'WHERE 1=1';

    if (status) {
      request.input('status', sql.VarChar(30), String(status));
      filters += ' AND rr.Status = @status';
    }
    if (search) {
      request.input('search', sql.NVarChar, `%${String(search).trim()}%`);
      filters += ` AND (
        m.Title LIKE @search
        OR u.FullName LIKE @search
        OR u.Email LIKE @search
        OR rr.BankAccountNumber LIKE @search
        OR rr.RefundTransactionCode LIKE @search
      )`;
    }

    const result = await request.query(`
      SELECT
        COUNT(*) AS TotalRefunds,
        SUM(CASE WHEN rr.Status = 'pending' THEN 1 ELSE 0 END) AS PendingRefunds,
        SUM(CASE WHEN rr.Status = 'approved' THEN 1 ELSE 0 END) AS ApprovedRefunds,
        SUM(CASE WHEN rr.Status = 'completed' THEN 1 ELSE 0 END) AS CompletedRefunds,
        SUM(CASE WHEN rr.Status = 'rejected' THEN 1 ELSE 0 END) AS RejectedRefunds,
        SUM(CASE WHEN rr.Status IN ('pending', 'approved') THEN rr.RefundAmount ELSE 0 END) AS PendingAmount,
        SUM(CASE WHEN rr.Status = 'completed' THEN rr.RefundAmount ELSE 0 END) AS CompletedAmount
      FROM RefundRequests rr
      JOIN Tickets t ON rr.TicketID = t.TicketID
      JOIN Users u ON rr.UserID = u.UserID
      JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
      JOIN Movies m ON st.MovieID = m.MovieID
      ${filters};

      SELECT
        rr.RefundID, rr.TicketID, rr.UserID, rr.RefundAmount, rr.Reason,
        rr.BankName, rr.BankAccountNumber, rr.BankAccountHolder,
        rr.Status, rr.AdminNote, rr.RefundTransactionCode,
        rr.RequestedAt, rr.ProcessedAt, rr.ProcessedBy, rr.CompletedAt,
        t.Status AS TicketStatus, t.PaymentMethod,
        u.FullName, u.Email, u.Phone,
        m.Title AS MovieTitle, m.PosterURL,
        st.StartTime, r.RoomName, c.CinemaName,
        s.SeatRow, s.SeatNumber,
        admin.FullName AS ProcessedByName
      FROM RefundRequests rr
      JOIN Tickets t ON rr.TicketID = t.TicketID
      JOIN Users u ON rr.UserID = u.UserID
      JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
      JOIN Movies m ON st.MovieID = m.MovieID
      JOIN Rooms r ON st.RoomID = r.RoomID
      JOIN Cinemas c ON r.CinemaID = c.CinemaID
      JOIN Seats s ON t.SeatID = s.SeatID
      LEFT JOIN Users admin ON rr.ProcessedBy = admin.UserID
      ${filters}
      ORDER BY rr.RequestedAt DESC, rr.RefundID DESC;
    `);

    const summary = result.recordsets[0][0] || {};
    return {
      summary: {
        totalRefunds: Number(summary.TotalRefunds || 0),
        pendingRefunds: Number(summary.PendingRefunds || 0),
        approvedRefunds: Number(summary.ApprovedRefunds || 0),
        completedRefunds: Number(summary.CompletedRefunds || 0),
        rejectedRefunds: Number(summary.RejectedRefunds || 0),
        pendingAmount: Number(summary.PendingAmount || 0),
        completedAmount: Number(summary.CompletedAmount || 0)
      },
      refunds: result.recordsets[1] || []
    };
  }

  static async updateRefundStatus(refundId, adminUserId, action, { adminNote, refundTransactionCode } = {}) {
    await ensureRefundSchema();
    const parsedId = parseInt(refundId, 10);
    if (!Number.isInteger(parsedId) || parsedId <= 0) throw new Error('RefundID không hợp lệ.');

    const normalizedAction = String(action || '').toLowerCase();
    const note = cleanText(adminNote, 500) || null;
    const txCode = cleanText(refundTransactionCode, 100) || null;
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const currentResult = await transaction.request()
        .input('refundId', sql.Int, parsedId)
        .query(`
          SELECT rr.*, t.VoucherID, t.PointsEarned, t.PointsAwardedAt, t.ShowtimeID
          FROM RefundRequests rr WITH (UPDLOCK)
          JOIN Tickets t ON rr.TicketID = t.TicketID
          WHERE rr.RefundID = @refundId
        `);
      const current = currentResult.recordset[0];
      if (!current) throw new Error('Không tìm thấy yêu cầu hoàn tiền.');

      if (current.Status === 'completed') throw new Error('Yêu cầu này đã hoàn tiền xong.');
      if (current.Status === 'rejected') throw new Error('Yêu cầu này đã bị từ chối.');

      let newStatus;
      if (normalizedAction === 'approve') {
        if (current.Status !== 'pending') throw new Error('Chỉ có thể duyệt yêu cầu đang chờ xử lý.');
        newStatus = 'approved';
      } else if (normalizedAction === 'reject') {
        if (!['pending', 'approved'].includes(current.Status)) throw new Error('Không thể từ chối yêu cầu này.');
        newStatus = 'rejected';
      } else if (normalizedAction === 'complete') {
        if (!['pending', 'approved'].includes(current.Status)) throw new Error('Không thể hoàn tất yêu cầu này.');
        if (!txCode) throw new Error('Vui lòng nhập mã giao dịch hoàn tiền.');
        newStatus = 'completed';
      } else {
        throw new Error('Thao tác refund không hợp lệ.');
      }

      const updateResult = await transaction.request()
        .input('refundId', sql.Int, parsedId)
        .input('status', sql.VarChar(30), newStatus)
        .input('adminNote', sql.NVarChar(500), note)
        .input('txCode', sql.VarChar(100), txCode)
        .input('processedBy', sql.Int, parseInt(adminUserId, 10))
        .query(`
          UPDATE RefundRequests
          SET Status = @status,
              AdminNote = COALESCE(@adminNote, AdminNote),
              RefundTransactionCode = COALESCE(@txCode, RefundTransactionCode),
              ProcessedAt = GETDATE(),
              ProcessedBy = @processedBy,
              CompletedAt = CASE WHEN @status = 'completed' THEN GETDATE() ELSE CompletedAt END
          OUTPUT INSERTED.*
          WHERE RefundID = @refundId;
        `);

      if (newStatus === 'approved') {
        await transaction.request()
          .input('ticketId', sql.Int, current.TicketID)
          .query(`
            UPDATE Tickets
            SET Status = 'refund_requested',
                RefundStatus = 'approved'
            WHERE TicketID = @ticketId;
          `);
      }

      if (newStatus === 'rejected') {
        await transaction.request()
          .input('ticketId', sql.Int, current.TicketID)
          .query(`
            UPDATE Tickets
            SET Status = 'confirmed',
                RefundStatus = 'rejected'
            WHERE TicketID = @ticketId;
          `);
      }

      if (newStatus === 'completed') {
        await RefundModel.applyCompletedRefund(transaction, current);
      }

      await transaction.commit();
      return updateResult.recordset[0];
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async applyCompletedRefund(transaction, refundRequest) {
    const ticketId = refundRequest.TicketID;

    const fnbResult = await transaction.request()
      .input('ticketId', sql.Int, ticketId)
      .query('SELECT FnBID, Quantity FROM Ticket_FnB WHERE TicketID = @ticketId');
    for (const item of fnbResult.recordset) {
      await transaction.request()
        .input('fnbId', sql.Int, item.FnBID)
        .input('qty', sql.Int, item.Quantity)
        .query('UPDATE FoodBeverages SET Stock = Stock + @qty WHERE FnBID = @fnbId');
    }

    if (refundRequest.VoucherID) {
      const activeCheck = await transaction.request()
        .input('userId', sql.Int, refundRequest.UserID)
        .input('voucherId', sql.Int, refundRequest.VoucherID)
        .input('ticketId', sql.Int, ticketId)
        .input('showtimeId', sql.Int, refundRequest.ShowtimeID)
        .query(`
          SELECT COUNT(*) AS ActiveCount 
          FROM Tickets 
          WHERE UserID = @userId 
            AND ShowtimeID = @showtimeId
            AND VoucherID = @voucherId 
            AND TicketID != @ticketId 
            AND Status IN ('confirmed', 'pending', 'refund_requested')
        `);
      
      const remainingActive = activeCheck.recordset[0].ActiveCount;

      if (remainingActive === 0) {
        await transaction.request()
          .input('voucherId', sql.Int, refundRequest.VoucherID)
          .query('UPDATE Vouchers SET UsedCount = CASE WHEN UsedCount > 0 THEN UsedCount - 1 ELSE 0 END WHERE VoucherID = @voucherId');
        await transaction.request()
          .input('voucherId', sql.Int, refundRequest.VoucherID)
          .input('userId', sql.Int, refundRequest.UserID)
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

    const points = Number(refundRequest.PointsEarned || 0);
    if (points > 0 && refundRequest.PointsAwardedAt) {
      const balanceResult = await transaction.request()
        .input('userId', sql.Int, refundRequest.UserID)
        .input('points', sql.Int, points)
        .query(`
          UPDATE Users
          SET RewardPoints = CASE WHEN ISNULL(RewardPoints, 0) >= @points THEN RewardPoints - @points ELSE 0 END
          OUTPUT INSERTED.RewardPoints
          WHERE UserID = @userId;
        `);
      const balanceAfter = balanceResult.recordset[0]?.RewardPoints || 0;
      await transaction.request()
        .input('userId', sql.Int, refundRequest.UserID)
        .input('ticketId', sql.Int, ticketId)
        .input('points', sql.Int, -points)
        .input('balanceAfter', sql.Int, balanceAfter)
        .query(`
          INSERT INTO RewardPointTransactions
            (UserID, TicketID, PointsChange, BalanceAfter, TransactionType, Description)
          VALUES
            (@userId, @ticketId, @points, @balanceAfter, 'adjust', N'Trừ điểm do hoàn tiền vé');
        `);
    }

    await transaction.request()
      .input('ticketId', sql.Int, ticketId)
      .query(`
        UPDATE Tickets
        SET Status = 'cancelled',
            RefundStatus = 'completed',
            CancelledAt = GETDATE(),
            RefundedAt = GETDATE(),
            PointsEarned = 0
        WHERE TicketID = @ticketId;
      `);
  }
}

module.exports = RefundModel;

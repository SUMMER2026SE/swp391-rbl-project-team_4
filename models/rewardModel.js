const { sql, getPool } = require('../config/db');

const POINTS_PER_VND = parseInt(process.env.REWARD_POINTS_PER_VND || '10000', 10);

const REWARD_CATALOG = [
  { id: 'RWD20', points: 100, amount: 20000, label: 'Voucher giảm 20.000đ' },
  { id: 'RWD50', points: 200, amount: 50000, label: 'Voucher giảm 50.000đ' },
  { id: 'RWD150', points: 500, amount: 150000, label: 'Voucher giảm 150.000đ' },
];

function calculatePoints(amount) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value / POINTS_PER_VND);
}

function getCatalogItem(rewardId) {
  return REWARD_CATALOG.find(item => item.id === String(rewardId || '').toUpperCase());
}

function makeVoucherCode(userId) {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `POINT${userId}${Date.now().toString(36).toUpperCase()}${rand}`.slice(0, 50);
}

class RewardModel {
  static getCatalog() {
    return REWARD_CATALOG.map(item => ({ ...item }));
  }

  static async getSummary(userId) {
    const pool = await getPool();

    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT UserID, RewardPoints
        FROM Users
        WHERE UserID = @userId
      `);

    if (userResult.recordset.length === 0) return null;

    const txResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT TOP 20 TransactionID, TicketID, VoucherID, PointsChange,
               BalanceAfter, TransactionType, Description, CreatedAt
        FROM RewardPointTransactions
        WHERE UserID = @userId
        ORDER BY CreatedAt DESC, TransactionID DESC
      `);

    const voucherResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT uv.UserVoucherID, uv.PointsSpent, uv.Source, uv.RedeemedAt,
               uv.IsUsed, uv.UsedAt,
               v.VoucherID, v.Code, v.DiscountType, v.DiscountValue,
               v.MinOrderValue, v.MaxDiscount, v.EndDate, v.IsActive
        FROM UserVouchers uv
        JOIN Vouchers v ON uv.VoucherID = v.VoucherID
        WHERE uv.UserID = @userId
        ORDER BY uv.RedeemedAt DESC
      `);

    return {
      points: userResult.recordset[0].RewardPoints || 0,
      catalog: RewardModel.getCatalog(),
      transactions: txResult.recordset,
      vouchers: voucherResult.recordset,
    };
  }

  static async awardPointsForTickets(transaction, ticketIds) {
    const ids = ticketIds.map(id => parseInt(id, 10)).filter(id => Number.isInteger(id) && id > 0);
    if (ids.length === 0) return [];

    const awarded = [];

    for (const ticketId of ids) {
      const ticketReq = transaction.request();
      ticketReq.input('ticketId', sql.Int, ticketId);
      const ticketResult = await ticketReq.query(`
        SELECT TicketID, UserID, TotalAmount, PointsAwardedAt
        FROM Tickets WITH (UPDLOCK)
        WHERE TicketID = @ticketId
          AND Status = 'confirmed'
          AND UserID IS NOT NULL
      `);

      if (ticketResult.recordset.length === 0) continue;
      const ticket = ticketResult.recordset[0];
      if (ticket.PointsAwardedAt) continue;

      const points = calculatePoints(ticket.TotalAmount);
      if (points <= 0) {
        await transaction.request()
          .input('ticketId', sql.Int, ticketId)
          .query('UPDATE Tickets SET PointsEarned = 0, PointsAwardedAt = GETDATE() WHERE TicketID = @ticketId');
        continue;
      }

      const userReq = transaction.request();
      userReq.input('userId', sql.Int, ticket.UserID);
      userReq.input('points', sql.Int, points);
      const userResult = await userReq.query(`
        UPDATE Users
        SET RewardPoints = ISNULL(RewardPoints, 0) + @points
        OUTPUT INSERTED.RewardPoints
        WHERE UserID = @userId
      `);

      const balanceAfter = userResult.recordset[0].RewardPoints;

      await transaction.request()
        .input('ticketId', sql.Int, ticketId)
        .input('points', sql.Int, points)
        .query(`
          UPDATE Tickets
          SET PointsEarned = @points,
              PointsAwardedAt = GETDATE()
          WHERE TicketID = @ticketId
        `);

      await transaction.request()
        .input('userId', sql.Int, ticket.UserID)
        .input('ticketId', sql.Int, ticketId)
        .input('points', sql.Int, points)
        .input('balanceAfter', sql.Int, balanceAfter)
        .input('description', sql.NVarChar, `Cộng ${points} điểm từ vé #${ticketId}`)
        .query(`
          INSERT INTO RewardPointTransactions
            (UserID, TicketID, PointsChange, BalanceAfter, TransactionType, Description)
          VALUES
            (@userId, @ticketId, @points, @balanceAfter, 'earn', @description)
        `);

      awarded.push({ ticketId, userId: ticket.UserID, points, balanceAfter });
    }

    return awarded;
  }

  static async redeemReward(userId, rewardId) {
    const reward = getCatalogItem(rewardId);
    if (!reward) throw new Error('Gói đổi điểm không hợp lệ.');

    const pool = await getPool();
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      const userReq = transaction.request();
      userReq.input('userId', sql.Int, userId);
      const userResult = await userReq.query(`
        SELECT UserID, RewardPoints
        FROM Users WITH (UPDLOCK)
        WHERE UserID = @userId
      `);

      if (userResult.recordset.length === 0) {
        throw new Error('Không tìm thấy người dùng.');
      }

      const currentPoints = userResult.recordset[0].RewardPoints || 0;
      if (currentPoints < reward.points) {
        throw new Error(`Bạn cần ${reward.points} điểm để đổi voucher này.`);
      }

      let code = makeVoucherCode(userId);
      for (let i = 0; i < 3; i++) {
        const exists = await transaction.request()
          .input('code', sql.VarChar, code)
          .query('SELECT VoucherID FROM Vouchers WHERE Code = @code');
        if (exists.recordset.length === 0) break;
        code = makeVoucherCode(userId);
      }

      const voucherReq = transaction.request();
      voucherReq.input('code', sql.VarChar, code);
      voucherReq.input('discountType', sql.VarChar, 'fixed');
      voucherReq.input('discountValue', sql.Decimal(18, 2), reward.amount);
      voucherReq.input('minOrderValue', sql.Decimal(18, 2), 0);
      voucherReq.input('maxDiscount', sql.Decimal(18, 2), reward.amount);
      const voucherResult = await voucherReq.query(`
        INSERT INTO Vouchers
          (Code, DiscountType, DiscountValue, MinOrderValue, MaxDiscount,
           UsageLimit, UsedCount, StartDate, EndDate, IsActive)
        OUTPUT INSERTED.VoucherID, INSERTED.Code
        VALUES
          (@code, @discountType, @discountValue, @minOrderValue, @maxDiscount,
           1, 0, CAST(GETDATE() AS date), DATEADD(day, 30, CAST(GETDATE() AS date)), 1)
      `);

      const voucher = voucherResult.recordset[0];
      const balanceAfter = currentPoints - reward.points;

      await transaction.request()
        .input('userId', sql.Int, userId)
        .input('points', sql.Int, reward.points)
        .query(`
          UPDATE Users
          SET RewardPoints = ISNULL(RewardPoints, 0) - @points
          WHERE UserID = @userId
        `);

      await transaction.request()
        .input('userId', sql.Int, userId)
        .input('voucherId', sql.Int, voucher.VoucherID)
        .input('pointsSpent', sql.Int, reward.points)
        .query(`
          INSERT INTO UserVouchers (UserID, VoucherID, PointsSpent, Source)
          VALUES (@userId, @voucherId, @pointsSpent, 'reward')
        `);

      await transaction.request()
        .input('userId', sql.Int, userId)
        .input('voucherId', sql.Int, voucher.VoucherID)
        .input('pointsChange', sql.Int, -reward.points)
        .input('balanceAfter', sql.Int, balanceAfter)
        .input('description', sql.NVarChar, `Đổi ${reward.points} điểm lấy ${reward.label}`)
        .query(`
          INSERT INTO RewardPointTransactions
            (UserID, VoucherID, PointsChange, BalanceAfter, TransactionType, Description)
          VALUES
            (@userId, @voucherId, @pointsChange, @balanceAfter, 'redeem', @description)
        `);

      await transaction.commit();

      return {
        points: balanceAfter,
        voucher: {
          voucherId: voucher.VoucherID,
          code: voucher.Code,
          discountType: 'fixed',
          discountValue: reward.amount,
          pointsSpent: reward.points,
          label: reward.label,
        },
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
}

module.exports = RewardModel;

const { getPool } = require('../config/db');

/**
 * Tự động dịch chuyển lịch chiếu mẫu nếu tất cả đã quá hạn
 */
async function autoShiftShowtimes() {
  try {
    const pool = await getPool();
    const dateResult = await pool.request().query('SELECT MIN(StartTime) as MinStartTime FROM Showtimes;');
    const minStartTime = dateResult.recordset[0].MinStartTime;
    if (!minStartTime) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minStartDay = new Date(minStartTime);
    minStartDay.setHours(0, 0, 0, 0);

    // Tính số ngày chênh lệch
    const diffTime = today.getTime() - minStartDay.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      console.log(`[Showtimes] 🕒 Phát hiện lịch chiếu cũ. Đang tự động dịch chuyển thêm ${diffDays} ngày...`);
      await pool.request().query(`
        UPDATE Showtimes
        SET StartTime = DATEADD(day, ${diffDays}, StartTime),
            EndTime = DATEADD(day, ${diffDays}, EndTime);
      `);
      console.log('[Showtimes] ✅ Đã cập nhật xong toàn bộ lịch chiếu sang mốc thời gian mới.');
    }
  } catch (err) {
    console.error('[Showtimes] ❌ Lỗi tự động cập nhật lịch chiếu:', err.message);
  }
}

module.exports = { autoShiftShowtimes };

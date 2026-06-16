// ============================================================
//  controllers/staffController.js  –  Staff / Counter APIs (MVC Refactored)
//  Dành cho: Nhân viên tại quầy (Role: Staff, Manager, Admin)
// ============================================================
const StaffModel = require('../models/staffModel');
const MovieModel = require('../models/movieModel'); // Reuse getSeatsByShowtime

// ─────────────────────────────────────────────────────────────
//  GET /api/staff/showtimes/today
// ─────────────────────────────────────────────────────────────
exports.getTodayShowtimes = async (req, res) => {
  try {
    const data = await StaffModel.getTodayShowtimes();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[staffController] getTodayShowtimes:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/staff/sell-ticket
// ─────────────────────────────────────────────────────────────
exports.sellTicketAtCounter = async (req, res) => {
  try {
    const { showtimeId, seatIds, foodItems = [], customerPhone, voucherCode, paymentMethod = 'cash' } = req.body;

    if (!showtimeId || !seatIds || seatIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp showtimeId và seatIds.' });
    }

    const result = await StaffModel.sellTicketAtCounter(req.user.userId, {
      showtimeId,
      seatIds,
      foodItems,
      customerPhone,
      voucherCode,
      paymentMethod
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('adminNotification', {
        title: 'Bán vé tại quầy thành công',
        message: `Đã bán ${seatIds.length} vé cho suất chiếu ${showtimeId}.`,
        time: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Bán vé tại quầy thành công!',
      data: result,
    });
  } catch (err) {
    console.error('[staffController] sellTicketAtCounter:', err.message);
    if (err.message.includes('đã được đặt') || err.message.includes('không tồn tại')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Lỗi server khi bán vé.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/staff/check-ticket
// ─────────────────────────────────────────────────────────────
exports.checkTicket = async (req, res) => {
  try {
    const { ticketId, qrCode } = req.body;

    if (!ticketId && !qrCode) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ticketId hoặc qrCode.' });
    }

    const ticket = await StaffModel.getTicketForCheck(ticketId, qrCode);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vé.' });
    }

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
    await StaffModel.markTicketAsUsed(ticket.TicketID);

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
// ─────────────────────────────────────────────────────────────
exports.getSeatsForSale = async (req, res) => {
  try {
    // Tái sử dụng hàm của MovieModel vì logic hoàn toàn giống nhau
    const data = await MovieModel.getSeatsByShowtime(req.params.showtimeId);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[staffController] getSeatsForSale:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

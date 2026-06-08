// ============================================================
//  controllers/bookingController.js  –  Booking / Ticket APIs (MVC Refactored)
//  Dành cho: Khách hàng đã đăng nhập (Role: Customer trở lên)
// ============================================================
const BookingModel = require('../models/bookingModel');

// ─────────────────────────────────────────────────────────────
//  GET /api/bookings/food-beverages
// ─────────────────────────────────────────────────────────────
exports.getFoodBeverages = async (req, res) => {
  try {
    const data = await BookingModel.getFoodBeverages();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[bookingController] getFoodBeverages:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getActiveVouchers = async (req, res) => {
  try {
    const data = await BookingModel.getActiveVouchers();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[bookingController] getActiveVouchers:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/bookings/validate-voucher
// ─────────────────────────────────────────────────────────────
exports.validateVoucher = async (req, res) => {
  try {
    const { voucherCode } = req.body;
    if (!voucherCode) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã voucher.' });
    }

    const voucher = await BookingModel.validateVoucher(voucherCode.trim().toUpperCase());

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Mã voucher không hợp lệ, đã hết hạn hoặc đã dùng hết.',
      });
    }

    res.json({
      success: true,
      message: 'Voucher hợp lệ!',
      voucher: {
        voucherId: voucher.VoucherID,
        code: voucher.Code,
        discountType: voucher.DiscountType,
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
// ─────────────────────────────────────────────────────────────
exports.createBooking = async (req, res) => {
  try {
    const { showtimeId, seatIds, foodItems = [], voucherCode, paymentMethod = 'online' } = req.body;

    if (!showtimeId || !seatIds || seatIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp showtimeId và seatIds.' });
    }

    const result = await BookingModel.createBooking(req.user.userId, {
      showtimeId,
      seatIds,
      foodItems,
      voucherCode,
      paymentMethod
    });

    res.status(201).json({
      success: true,
      message: 'Đặt vé thành công!',
      data: result,
    });
  } catch (err) {
    console.error('[bookingController] createBooking:', err.message);
    // Phân loại lỗi trả về từ Model để set status code phù hợp
    if (err.message.includes('đã được đặt') || err.message.includes('không tồn tại') || err.message.includes('chưa được thiết lập giá')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo vé.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/bookings/my-bookings
// ─────────────────────────────────────────────────────────────
exports.getMyBookings = async (req, res) => {
  try {
    const data = await BookingModel.getMyBookings(req.user.userId);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[bookingController] getMyBookings:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/bookings/:ticketId
// ─────────────────────────────────────────────────────────────
exports.getBookingDetail = async (req, res) => {
  try {
    const ticketData = await BookingModel.getBookingDetail(req.params.ticketId);

    if (!ticketData) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vé.' });
    }

    // Kiểm tra quyền: chỉ được xem vé của chính mình (trừ Staff/Admin)
    const allowedRoles = ['Super Admin', 'Admin', 'Manager'];
    if (!allowedRoles.includes(req.user.roleName) && ticketData.UserID !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem vé này.' });
    }

    res.json({
      success: true,
      data: ticketData,
    });
  } catch (err) {
    console.error('[bookingController] getBookingDetail:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

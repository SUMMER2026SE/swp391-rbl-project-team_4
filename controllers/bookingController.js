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

exports.getPaymentQRImages = async (req, res) => {
  try {
    const data = await BookingModel.getPaymentQRImages();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[bookingController] getPaymentQRImages:', err.message);
    // Fallback nếu bảng chưa tạo
    res.json({
      success: true,
      data: [
        { PaymentMethod: 'qrpay', ImagePath: '/images/qr_vietqr_mb.png', DisplayName: 'QR Pay (VietQR/MB)', AccountName: 'D-CINEMA PAYMENT', AccountNumber: '', BankName: 'MB Bank' },
        { PaymentMethod: 'momo',  ImagePath: '/images/qr_momo.png',      DisplayName: 'Ví MoMo',           AccountName: 'D-CINEMA',         AccountNumber: '', BankName: 'MoMo'    }
      ]
    });
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
    if (
      err.message.includes('đã được đặt') ||
      err.message.includes('không tồn tại') ||
      err.message.includes('chưa được thiết lập giá') ||
      err.message.includes('không hợp lệ') ||
      err.message.includes('không đủ số lượng') ||
      err.message.includes('đã ngừng bán') ||
      err.message.includes('không được hỗ trợ')
    ) {
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

// ─────────────────────────────────────────────────────────────
//  GET /api/bookings/check-status
// ─────────────────────────────────────────────────────────────
exports.checkBookingStatus = async (req, res) => {
  try {
    const { ticketIds } = req.query;
    if (!ticketIds) {
      return res.status(400).json({ success: false, message: 'Thiếu ticketIds.' });
    }

    const ids = ticketIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ticketIds không hợp lệ.' });
    }

    let tickets = await BookingModel.checkBookingStatus(ids);
    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vé tương ứng.' });
    }

    const pendingTickets = tickets.filter(t => t.Status === 'pending');
    if (pendingTickets.length > 0) {
      const sepayApiKey = process.env.SEPAY_API_KEY;
      let hasBeenPaid = false;

      if (sepayApiKey && sepayApiKey !== 'DEMO') {
        // --- REAL SEPAY INTEGRATION ---
        try {
          const expectedNote = 'DCVIP' + ids.join('T');
          const totalRequired = pendingTickets.reduce((sum, t) => sum + parseFloat(t.TotalAmount), 0);

          console.log(`[SePay] Checking transactions for note: ${expectedNote}, amount: ${totalRequired}`);
          
          const response = await fetch('https://userapi.sepay.vn/v2/transactions?per_page=30', {
            headers: { 'Authorization': `Bearer ${sepayApiKey}` }
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.transactions && Array.isArray(result.transactions)) {
              // Tìm giao dịch có nội dung chuyển khoản chứa expectedNote
              const match = result.transactions.find(tx => {
                const txContent = tx.transaction_content || '';
                const txAmount = parseFloat(tx.amount_in || 0);
                
                return txContent.toUpperCase().includes(expectedNote.toUpperCase()) &&
                       txAmount >= totalRequired;
              });

              if (match) {
                console.log(`[SePay] ✅ Match found! Transaction ID: ${match.id}. Confirming booking.`);
                hasBeenPaid = true;
              }
            }
          } else {
            console.error('[SePay API] Error response:', response.status);
          }
        } catch (sepayErr) {
          console.error('[SePay Integration Error]:', sepayErr.message);
        }
      } else {
        // --- SIMULATED MOCK FALLBACK (12 seconds) ---
        const firstTicket = pendingTickets[0];
        if (firstTicket.SecondsElapsed >= 12) {
          console.log(`[Payment Simulation] Auto-confirming tickets after 12s demo time.`);
          hasBeenPaid = true;
        }
      }

      if (hasBeenPaid) {
        const ticketIdsToConfirm = pendingTickets.map(t => t.TicketID);
        await BookingModel.confirmBooking(ticketIdsToConfirm);
        // Cập nhật trạng thái trong kết quả trả về
        tickets.forEach(t => {
          if (ticketIdsToConfirm.includes(t.TicketID)) t.Status = 'confirmed';
        });
      }
    }

    const allConfirmed = tickets.every(t => t.Status === 'confirmed');

    res.json({
      success: true,
      data: tickets.map(t => ({ ticketId: t.TicketID, status: t.Status })),
      allConfirmed
    });
  } catch (err) {
    console.error('[bookingController] checkBookingStatus:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/bookings/cancel
// ─────────────────────────────────────────────────────────────
exports.cancelBooking = async (req, res) => {
  try {
    const { ticketIds } = req.body;
    if (!ticketIds || !Array.isArray(ticketIds)) {
      return res.status(400).json({ success: false, message: 'Danh sách ticketIds không hợp lệ.' });
    }

    await BookingModel.cancelBooking(ticketIds);
    res.json({ success: true, message: 'Đã hủy giữ chỗ thành công.' });
  } catch (err) {
    console.error('[bookingController] cancelBooking:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server khi hủy giữ chỗ.' });
  }
};

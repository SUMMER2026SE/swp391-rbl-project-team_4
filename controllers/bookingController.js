// ============================================================
//  controllers/bookingController.js  –  Booking / Ticket APIs (MVC Refactored)
//  Dành cho: Khách hàng đã đăng nhập (Role: Customer trở lên)
// ============================================================
const BookingModel = require('../models/bookingModel');
const { getPool }  = require('../config/db');
// Socket.IO helper: push real-time payment_confirmed về đúng checkout tab của khách
const { emitPaymentConfirmed } = require('../sockets/socketManager');

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
    let data = await BookingModel.getPaymentQRImages();
    
    // Đọc đè cấu hình ngân hàng từ file .env nếu có để dễ quản trị
    data = data.map(item => {
      if (item.PaymentMethod === 'qrpay') {
        const bankCode = process.env.SEPAY_BANK_CODE || item.BankCode;
        return {
          ...item,
          AccountNumber: process.env.SEPAY_BANK_ACCOUNT || item.AccountNumber,
          BankCode: bankCode,
          AccountName: process.env.SEPAY_ACCOUNT_NAME || item.AccountName,
          DisplayName: `QR Pay (VietQR / ${bankCode})`,
          BankName: `${bankCode} Bank`
        };
      }
      if (item.PaymentMethod === 'momo') {
        return {
          ...item,
          AccountNumber: process.env.MOMO_BANK_ACCOUNT || item.AccountNumber,
          AccountName: process.env.MOMO_ACCOUNT_NAME || item.AccountName
        };
      }
      return item;
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error('[bookingController] getPaymentQRImages:', err.message);
    // Fallback nếu bảng chưa tạo hoặc có lỗi CSDL
    const sepayBankCode = process.env.SEPAY_BANK_CODE || 'MB';
    res.json({
      success: true,
      data: [
        { 
          PaymentMethod: 'qrpay', 
          ImagePath: '/images/qr_vietqr_mb.png', 
          DisplayName: `QR Pay (VietQR / ${sepayBankCode})`, 
          AccountName: process.env.SEPAY_ACCOUNT_NAME || 'NGUYEN MINH HUY', 
          AccountNumber: process.env.SEPAY_BANK_ACCOUNT || '0949391487', 
          BankName: `${sepayBankCode} Bank`,
          BankCode: sepayBankCode
        },
        { 
          PaymentMethod: 'momo',  
          ImagePath: '/images/qr_momo.png',      
          DisplayName: 'Ví MoMo',           
          AccountName: process.env.MOMO_ACCOUNT_NAME || 'NGUYEN MINH HUY', 
          AccountNumber: process.env.MOMO_BANK_ACCOUNT || '0949391487', 
          BankName: 'MoMo',
          BankCode: 'MOMO'
        }
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


// ─────────────────────────────────────────────────────────────
//  GET /api/bookings/check-status — Check payment status (polls from client)
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

      // Nếu cấu hình SePay API Key, hỗ trợ đối soát chủ động bằng cách gọi API lịch sử của SePay
      if (sepayApiKey && sepayApiKey !== 'DEMO') {
        try {
          const expectedNote = 'DCVIP' + ids.join('T');
          const totalRequired = await BookingModel.getBookingTotalAmount(ids);

          console.log(`[SePay Polling Check] Checking transaction history for note: ${expectedNote}, required amount: ${totalRequired}`);
          
          const response = await fetch('https://userapi.sepay.vn/v2/transactions?per_page=30', {
            headers: { 'Authorization': `Bearer ${sepayApiKey}` }
          });
          
          if (response.ok) {
            const result = await response.json();
            const transactionsList = result.transactions || result.data || [];
            if (Array.isArray(transactionsList)) {
              const match = transactionsList.find(tx => {
                const txContent = tx.transaction_content || '';
                const txAmount = parseFloat(tx.amount_in || 0);
                
                return txContent.toUpperCase().includes(expectedNote.toUpperCase()) &&
                       txAmount >= totalRequired;
              });

              if (match) {
                console.log(`[SePay Polling Check] ✅ Match found! Transaction ID: ${match.id || match.reference_number}. Confirming booking with transaction log.`);
                
                const gateway = match.bank_brand_name || 'SePay';
                const transactionDate = match.transaction_date ? new Date(match.transaction_date) : new Date();
                const accountNumber = match.account_number || '';
                const amountIn = parseFloat(match.amount_in || 0);
                const referenceNumber = match.reference_number || String(match.id) || `TX-${Date.now()}`;
                const transactionContent = match.transaction_content || '';
                const paymentMethod = transactionContent.toLowerCase().includes('momo') ? 'momo' : 'qrpay';

                try {
                  await BookingModel.confirmBookingWithTransaction(ids, {
                    gateway,
                    transactionDate,
                    accountNumber,
                    amountIn,
                    referenceNumber,
                    transactionContent,
                    paymentMethod,
                    rawData: match
                  });
                  hasBeenPaid = true;

                  // 🔴 REAL-TIME: Push về checkout tab của khách ngay khi polling phát hiện tiền về
                  try {
                    emitPaymentConfirmed(ids, {
                      gateway, amountIn, referenceNumber, paymentMethod, source: 'polling'
                    });
                  } catch (emitErr) {
                    console.warn('[Polling] emitPaymentConfirmed failed (non-critical):', emitErr.message);
                  }
                } catch (dbErr) {
                  if (dbErr.code === 'DUPLICATE_TRANSACTION') {
                    console.log(`[SePay Polling Check] Giao dịch trùng lặp đã được xử lý thành công trước đó.`);
                    hasBeenPaid = true;
                    // Vẫn emit để đảm bảo client redirect nếu chưa nhận được event trước
                    try { emitPaymentConfirmed(ids, { source: 'polling-duplicate' }); } catch (_) {}
                  } else {
                    console.error('[SePay Polling Check DB Error]:', dbErr.message);
                  }
                }
              }
            }
          }
        } catch (sepayErr) {
          console.error('[SePay Polling Check Error]:', sepayErr.message);
        }
      }

      if (hasBeenPaid) {
        tickets.forEach(t => {
          if (ids.includes(t.TicketID)) t.Status = 'confirmed';
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
//  POST /api/bookings/webhook — Receive payment notifications (Standard SePay / PayOS & Simulator)
// ─────────────────────────────────────────────────────────────
exports.receivePaymentWebhook = async (req, res) => {
  try {
    console.log('[Payment Webhook] Received payment notification body:', JSON.stringify(req.body));

    // 1. Kiểm tra Token bảo mật (nếu có cấu hình trong .env)
    const secretToken = process.env.PAYMENT_WEBHOOK_SECRET || 'dev_webhook_secret_token';
    let reqToken = req.headers['x-api-key'] || req.query.token;
    if (!reqToken && req.headers['authorization']) {
      reqToken = req.headers['authorization']
        .replace(/Bearer\s+/i, '')
        .replace(/Apikey\s+/i, '')
        .trim();
    }

    if (process.env.PAYMENT_WEBHOOK_SECRET && reqToken !== secretToken) {
      console.warn(`[Webhook Warning] Unauthorized webhook attempt. Provided token: ${reqToken}`);
      return res.status(401).json({ success: false, message: 'Unauthorized webhook request.' });
    }

    // 2. Trích xuất thông tin giao dịch từ các định dạng khác nhau (SePay, PayOS hoặc Simulator)
    let gateway = 'Unknown';
    let transactionDate = new Date();
    let accountNumber = 'Unknown';
    let amountIn = 0;
    let referenceNumber = '';
    let transactionContent = '';
    let rawData = req.body;

    if (req.body.gateway) {
      // Định dạng SePay hoặc Simulator gửi trực tiếp
      gateway = req.body.gateway;
      transactionDate = req.body.transactionDate || new Date();
      accountNumber = req.body.accountNumber || '';
      amountIn = parseFloat(req.body.transferAmount || req.body.amount_in || req.body.amountIn || 0);
      referenceNumber = req.body.code || req.body.referenceCode || req.body.referenceNumber || `TX-${Date.now()}`;
      transactionContent = req.body.content || req.body.transactionContent || '';
    } else if (req.body.data && req.body.data.reference) {
      // Định dạng PayOS Webhook
      const d = req.body.data;
      gateway = 'PayOS';
      transactionDate = d.transactionDateTime || new Date();
      accountNumber = d.accountNumber || '';
      amountIn = parseFloat(d.amount || 0);
      referenceNumber = d.reference;
      transactionContent = d.description || '';
    } else {
      // Fallback
      gateway = req.body.gateway || 'Simulator';
      transactionDate = req.body.transactionDate || new Date();
      accountNumber = req.body.accountNumber || '0949391487';
      amountIn = parseFloat(req.body.amountIn || req.body.amount || 0);
      referenceNumber = req.body.referenceNumber || req.body.code || `SIM-${Date.now()}`;
      transactionContent = req.body.transactionContent || req.body.content || '';
    }

    const paymentMethod = transactionContent.toLowerCase().includes('momo') ? 'momo' : 'qrpay';

    console.log(`[Payment Webhook] Extracted: Gateway=${gateway}, RefNo=${referenceNumber}, Amount=${amountIn}, Content="${transactionContent}"`);

    // 3. Phân tích nội dung chuyển khoản để tìm mã vé (DCVIP + ticketIds nối bằng chữ T)
    const match = transactionContent.match(/DCVIP(\d+(?:T\d+)*)/i);
    if (!match) {
      console.log(`[Payment Webhook] Nội dung chuyển khoản không chứa mã vé phù hợp: "${transactionContent}". Bỏ qua.`);
      return res.status(200).json({ success: false, message: 'Nội dung chuyển khoản không chứa mã vé hợp lệ (DCVIP...).' });
    }

    const ticketIds = match[1].split('T').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    if (ticketIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Mã vé trích xuất không hợp lệ.' });
    }

    // 4. Kiểm tra trạng thái hiện tại của vé trong CSDL
    let tickets = await BookingModel.checkBookingStatus(ticketIds);
    if (tickets.length === 0) {
      console.warn(`[Payment Webhook] Không tìm thấy vé tương ứng với danh sách IDs: ${ticketIds.join(', ')}`);
      return res.status(404).json({ success: false, message: 'Không tìm thấy vé trong hệ thống.' });
    }

    const pendingTickets = tickets.filter(t => t.Status === 'pending');
    if (pendingTickets.length === 0) {
      const allConfirmed = tickets.every(t => t.Status === 'confirmed');
      if (allConfirmed) {
        console.log(`[Payment Webhook] Vé [${ticketIds.join(', ')}] đã được xác nhận trước đó (Idempotent OK).`);
        return res.json({ success: true, message: 'Các vé đã được thanh toán và xác nhận từ trước.' });
      }
      return res.status(400).json({ success: false, message: 'Vé không nằm trong trạng thái chờ thanh toán.' });
    }

    // 5. Đối soát số tiền nhận được với tổng số tiền cần thanh toán của nhóm vé (bao gồm cả đồ ăn đi kèm)
    const totalRequired = await BookingModel.getBookingTotalAmount(ticketIds);
    if (amountIn < totalRequired) {
      console.warn(`[Payment Webhook Warning] Số tiền chuyển khoản nhỏ hơn số tiền vé. Cần: ${totalRequired}, Nhận: ${amountIn}`);
      return res.status(400).json({
        success: false,
        message: `Số tiền thanh toán không đủ. Yêu cầu: ${totalRequired.toLocaleString('vi-VN')}đ, Nhận: ${amountIn.toLocaleString('vi-VN')}đ.`
      });
    }

    // 6. Xác nhận vé và lưu giao dịch vào bảng PaymentTransactions (sử dụng Transaction CSDL để đảm bảo tính toàn vẹn)
    try {
      await BookingModel.confirmBookingWithTransaction(ticketIds, {
        gateway,
        transactionDate,
        accountNumber,
        amountIn,
        referenceNumber,
        transactionContent,
        paymentMethod,
        rawData
      });

      console.log(`[Payment Webhook] ✅ Xác nhận và ghi nhận giao dịch thành công cho vé [${ticketIds.join(', ')}]`);

      // 🔴 REAL-TIME: Push ngay về checkout tab đang mở của khách hàng qua Socket.IO
      // Điều này đảm bảo redirect tức thì ngay cả khi polling bị throttle (tab background)
      try {
        emitPaymentConfirmed(ticketIds, {
          gateway,
          amountIn,
          referenceNumber,
          paymentMethod,
          source: 'webhook'
        });
      } catch (emitErr) {
        console.warn('[Webhook] emitPaymentConfirmed failed (non-critical):', emitErr.message);
      }

      return res.json({
        success: true,
        message: `Xác nhận thanh toán thành công cho vé [${ticketIds.join(', ')}].`,
        data: { ticketIds, amountIn, referenceNumber }
      });
    } catch (err) {
      if (err.code === 'DUPLICATE_TRANSACTION') {
        console.log(`[Payment Webhook] Giao dịch ${referenceNumber} đã xử lý từ trước. Trả về OK để ngừng retry.`);
        return res.json({ success: true, message: 'Giao dịch trùng lặp đã được xử lý thành công trước đó.' });
      }
      throw err;
    }
  } catch (err) {
    console.error('[bookingController] receivePaymentWebhook:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server khi xử lý webhook thanh toán.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/bookings/webhook/pending — Get pending bookings for developer simulator
// ─────────────────────────────────────────────────────────────
exports.getPendingWebhooks = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT t.TicketID, t.TotalAmount, t.BookedAt,
             m.Title AS MovieTitle,
             s.SeatRow, s.SeatNumber,
             u.FullName AS CustomerName
      FROM   Tickets t
      JOIN   Showtimes st ON t.ShowtimeID = st.ShowtimeID
      JOIN   Movies    m  ON st.MovieID   = m.MovieID
      JOIN   Seats     s  ON t.SeatID     = s.SeatID
      JOIN   Users     u  ON t.UserID     = u.UserID
      WHERE  t.Status = 'pending'
      ORDER BY t.BookedAt DESC
    `);

    const tickets = result.recordset;
    if (tickets.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const bookingsMap = {};

    for (const t of tickets) {
      const timeStr = t.BookedAt instanceof Date ? t.BookedAt.toISOString().slice(0, 16) : String(t.BookedAt);
      const key = `${t.CustomerName}_${t.MovieTitle}_${timeStr}`;
      
      if (!bookingsMap[key]) {
        bookingsMap[key] = {
          customerName: t.CustomerName,
          bookedAt: t.BookedAt,
          movieTitle: t.MovieTitle,
          ticketIds: [],
          seats: [],
          ticketAmount: 0
        };
      }
      bookingsMap[key].ticketIds.push(t.TicketID);
      bookingsMap[key].seats.push(`${t.SeatRow}${t.SeatNumber}`);
      bookingsMap[key].ticketAmount += parseFloat(t.TotalAmount);
    }

    const bookings = Object.values(bookingsMap);

    // Bổ sung thêm phần F&B vào mỗi nhóm vé
    for (const b of bookings) {
      const fnbResult = await pool.request().query(`
        SELECT SUM(tf.Quantity * fb.Price) AS FnBSum
        FROM Ticket_FnB tf
        JOIN FoodBeverages fb ON tf.FnBID = fb.FnBID
        WHERE tf.TicketID IN (${b.ticketIds.join(',')})
      `);
      const fnbSum = parseFloat(fnbResult.recordset[0].FnBSum || 0);
      b.totalAmount = b.ticketAmount + fnbSum;
      b.transferNote = 'DCVIP' + b.ticketIds.sort((x, y) => x - y).join('T');
    }

    res.json({ success: true, data: bookings });
  } catch (err) {
    console.error('[bookingController] getPendingWebhooks:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

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

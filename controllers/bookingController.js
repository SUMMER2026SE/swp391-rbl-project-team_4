// ============================================================
//  controllers/bookingController.js  –  Booking / Ticket APIs (MVC Refactored)
//  Dành cho: Khách hàng đã đăng nhập (Role: Customer trở lên)
// ============================================================
const BookingModel = require('../models/bookingModel');
const { getPool } = require('../config/db');
const { sendBookingEmail } = require('../services/emailService');
// Socket.IO helper: push real-time payment_confirmed về đúng checkout tab của khách
const { emitPaymentConfirmed } = require('../sockets/socketManager');
const os = require('os');

function toUtcDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value);
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(text);
  return new Date(hasTimezone ? text : `${text}Z`);
}

function formatVietnamDateTime(value) {
  const date = toUtcDate(value);
  if (!date || Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getVerificationUrl(req, ticketId) {
  let host = req ? req.get('host') : 'localhost:9999';
  const protocol = req && req.protocol ? req.protocol : 'http';

  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    try {
      const interfaces = os.networkInterfaces();
      let candidates = [];
      for (const devName in interfaces) {
        if (/virtual|vmware|vbox|vethernet|pseudo/i.test(devName)) continue;

        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
          const alias = iface[i];
          if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
            const isWifi = /wi-fi|wifi|wireless|wlan/i.test(devName);
            candidates.push({ devName, ip: alias.address, isWifi });
          }
        }
      }
      candidates.sort((a, b) => (b.isWifi ? 1 : 0) - (a.isWifi ? 1 : 0));
      if (candidates.length > 0) {
        const ipAddress = candidates[0].ip;
        const port = host.split(':')[1] || '9999';
        host = `${ipAddress}:${port}`;
      }
    } catch (err) {
      console.error('Error replacing localhost with LAN IP:', err.message);
    }
  }

  return `${protocol}://${host}/verify-ticket.html?id=${ticketId}`;
}

async function sendGroupedBookingEmail(ticketIds, req) {
  if (!ticketIds || ticketIds.length === 0) return;

  try {
    const pool = await getPool();

    // 1. Lấy thông tin chi tiết của nhóm vé
    const result = await pool.request().query(`
      SELECT t.TicketID, t.Status, t.TicketPrice, t.TotalAmount, t.PaymentMethod,
             m.Title AS MovieTitle, m.PosterURL, m.Duration,
             CONVERT(varchar(19), st.StartTime, 126) + 'Z' AS StartTime,
             CONVERT(varchar(19), st.EndTime, 126) + 'Z' AS EndTime,
             r.RoomName,
             c.CinemaName, c.Address,
             s.SeatRow, s.SeatNumber, s.SeatType,
             u.FullName AS CustomerName, u.Email AS UserEmail, u.Phone AS CustomerPhone
      FROM   Tickets t
      JOIN   Showtimes st ON t.ShowtimeID = st.ShowtimeID
      JOIN   Movies    m  ON st.MovieID   = m.MovieID
      JOIN   Rooms     r  ON st.RoomID    = r.RoomID
      JOIN   Cinemas   c  ON r.CinemaID   = c.CinemaID
      JOIN   Seats     s  ON t.SeatID     = s.SeatID
      JOIN   Users     u  ON t.UserID     = u.UserID
      WHERE  t.TicketID IN (${ticketIds.join(',')})
    `);

    if (result.recordset.length === 0) {
      console.warn(`[sendGroupedBookingEmail] Không tìm thấy chi tiết vé cho IDs: ${ticketIds.join(', ')}`);
      return;
    }

    const recordset = result.recordset;
    const first = recordset[0];
    const userEmail = first.UserEmail;
    if (!userEmail) {
      console.warn(`[sendGroupedBookingEmail] Người dùng không có email cho nhóm vé: ${ticketIds.join(', ')}`);
      return;
    }

    const seatsList = recordset.map(r => `${r.SeatRow}${r.SeatNumber}`).sort();
    const uniqueSeats = [...new Set(seatsList)];
    const ticketSum = recordset.reduce((sum, item) => sum + parseFloat(item.TotalAmount || 0), 0);

    // 2. Lấy thông tin đồ ăn F&B đi kèm
    const fnbResult = await pool.request().query(`
      SELECT fb.Name, tf.Quantity, fb.Price
      FROM   Ticket_FnB tf
      JOIN   FoodBeverages fb ON tf.FnBID = fb.FnBID
      WHERE  tf.TicketID IN (${ticketIds.join(',')})
    `);

    const foodDisplayItems = fnbResult.recordset.map(item => `${item.Quantity}x ${item.Name}`);
    const fnbSum = fnbResult.recordset.reduce((sum, item) => sum + (item.Quantity * parseFloat(item.Price || 0)), 0);
    const grandTotal = ticketSum + fnbSum;

    const bookingId = 'DC-' + ticketIds.sort((a, b) => a - b).join('-');
    const verifyIdsStr = ticketIds.sort((a, b) => a - b).join(',');
    const verifyUrl = getVerificationUrl(req, verifyIdsStr);

    const bookingInfo = {
      customerName: first.CustomerName || 'Khách hàng',
      movieTitle: first.MovieTitle,
      cinemaName: first.CinemaName,
      roomName: first.RoomName,
      showtime: formatVietnamDateTime(first.StartTime),
      seats: uniqueSeats.join(', '),
      food: foodDisplayItems.join(', ') || '',
      totalAmount: grandTotal.toLocaleString('vi-VN') + 'đ',
      ticketCode: bookingId,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`
    };

    await sendBookingEmail(userEmail, bookingInfo);
  } catch (err) {
    console.error(`[sendGroupedBookingEmail] ❌ Lỗi khi gửi email nhóm vé:`, err.message);
  }
}

async function sendBookingConfirmationEmails(ticketIds, source = 'booking', req = null) {
  await sendGroupedBookingEmail(ticketIds, req);
}

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
//  POST /api/bookings/calculate-price
// ─────────────────────────────────────────────────────────────
exports.calculatePrice = async (req, res) => {
  try {
    const { showtimeId, seatIds, foodItems = [], voucherCode } = req.body;
    if (!showtimeId || !seatIds || seatIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp showtimeId và seatIds.' });
    }

    const result = await BookingModel.calculateBookingPrice(req.user.userId, {
      showtimeId,
      seatIds,
      foodItems,
      voucherCode
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('[bookingController] calculatePrice:', err.message);
    res.status(400).json({ success: false, message: err.message });
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

    const userId = req.user ? req.user.userId : null;
    const voucher = await BookingModel.validateVoucher(voucherCode.trim().toUpperCase(), userId);

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Mã voucher không hợp lệ, đã hết hạn hoặc đã dùng hết.',
      });
    }

    if (voucher.alreadyUsed) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã sử dụng voucher này rồi. Mỗi khách hàng chỉ được sử dụng mã này 1 lần.',
      });
    }

    if (voucher.notOwned) {
      return res.status(403).json({
        success: false,
        message: 'Voucher này thuộc tài khoản khác.',
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
    const { showtimeId, seatIds, foodItems = [], voucherCode, paymentMethod = 'qrpay', sessionId } = req.body;

    if (!showtimeId || !seatIds || seatIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp showtimeId và seatIds.' });
    }

    const result = await BookingModel.createBooking(req.user.userId, {
      showtimeId,
      seatIds,
      foodItems,
      voucherCode,
      paymentMethod,
      sessionId
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('adminNotification', {
        title: 'Khách hàng đặt vé Online',
        message: `Đã đặt ${seatIds.length} vé cho suất chiếu ${showtimeId}.`,
        time: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Đặt vé thành công!',
      data: result,
    });
  } catch (err) {
    console.error('[bookingController] createBooking:', err.message);
    // Phân loại lỗi trả về từ Model để set status code phù hợp
    if (
      err.message.includes('không tồn tại') ||
      err.message.includes('chưa được thiết lập giá') ||
      err.message.includes('không hợp lệ') ||
      err.message.includes('đã ngừng bán') ||
      err.message.includes('không được hỗ trợ') ||
      err.message.includes('đồ ăn') ||
      err.message.includes('số lượng') ||
      err.message.includes('tối đa 10')
    ) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (
      err.message.includes('đã được đặt') ||
      err.message.includes('đã bị người khác chọn') ||
      err.message.includes('không đủ số lượng') ||
      err.message.includes('chỉ còn lại') ||
      err.message.includes('Voucher')
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

                  await sendBookingConfirmationEmails(ids, 'Polling', req);
                } catch (dbErr) {
                  if (dbErr.code === 'DUPLICATE_TRANSACTION') {
                    console.log(`[SePay Polling Check] Giao dịch trùng lặp đã được xử lý thành công trước đó.`);
                    hasBeenPaid = true;
                    // Vẫn emit để đảm bảo client redirect nếu chưa nhận được event trước
                    try { emitPaymentConfirmed(ids, { source: 'polling-duplicate' }); } catch (_) { }
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
//  GET /api/bookings/webhook — Xác thực URL webhook với SePay
//  SePay gửi GET request khi đăng ký webhook để kiểm tra endpoint hoạt động
// ─────────────────────────────────────────────────────────────
exports.verifyWebhookUrl = (req, res) => {
  console.log('[Webhook Verify] SePay verification request received.');
  // Trả về 200 OK để SePay xác nhận URL hợp lệ
  return res.status(200).json({
    success: true,
    message: 'CinemaVerse webhook endpoint is active.',
    timestamp: new Date().toISOString()
  });
};

// ─────────────────────────────────────────────────────────────
//  POST /api/bookings/webhook — Receive payment notifications (Standard SePay / PayOS & Simulator)
// ─────────────────────────────────────────────────────────────
exports.receivePaymentWebhook = async (req, res) => {
  try {
    console.log('[Payment Webhook] Received payment notification body:', JSON.stringify(req.body));

    // 1. Kiểm tra token bảo mật. Local simulator có thể chạy không token trong development,
    // nhưng production phải có token đúng để tránh xác nhận thanh toán giả.
    const secretToken = process.env.PAYMENT_WEBHOOK_SECRET || 'dev_webhook_secret_token';
    const isProduction = process.env.NODE_ENV === 'production';
    let reqToken = req.headers['x-api-key'] || req.query.token;
    if (!reqToken && req.headers['authorization']) {
      reqToken = req.headers['authorization']
        .replace(/Bearer\s+/i, '')
        .replace(/Apikey\s+/i, '')
        .trim();
    }

    if (reqToken && reqToken !== secretToken) {
      console.warn('[Webhook Warning] Token không hợp lệ.');
      return res.status(401).json({ success: false, message: 'Unauthorized webhook request.' });
    }
    if (!reqToken) {
      if (isProduction) {
        console.warn('[Webhook Warning] Thiếu token xác thực trong production.');
        return res.status(401).json({ success: false, message: 'Unauthorized webhook request.' });
      }
      console.log('[Webhook] Không có token xác thực - chỉ chấp nhận trong development/simulator.');
    } else {
      console.log('[Webhook] Xác thực token thành công.');
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
      // Ưu tiên mã giao dịch ngân hàng thực tế (referenceCode/referenceNumber) để tránh trùng lặp
      referenceNumber = req.body.referenceCode || req.body.referenceNumber || req.body.code || `TX-${Date.now()}`;
      // SePay gửi nội dung qua 'content' và mô tả ngân hàng qua 'description'
      transactionContent = req.body.content || req.body.transactionContent || req.body.description || '';
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
      transactionContent = req.body.transactionContent || req.body.content || req.body.description || '';
    }

    const paymentMethod = transactionContent.toLowerCase().includes('momo') ? 'momo' : 'qrpay';

    console.log(`[Payment Webhook] Extracted: Gateway=${gateway}, RefNo=${referenceNumber}, Amount=${amountIn}, Content="${transactionContent}"`);

    // 3. Phân tích nội dung chuyển khoản để tìm mã vé (DCVIP + ticketIds nối bằng chữ T)
    // Kiểm tra cả trong content lẫn các trường phụ để tăng độ tin cậy
    const allContent = [
      transactionContent,
      req.body.description || '',
      req.body.content || ''
    ].join(' ');
    const match = allContent.match(/DCVIP(\d+(?:T\d+)*)/i);
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

      // 📧 GỬI EMAIL XÁC NHẬN VÉ ĐIỆN TỬ (GROUPED)
      try {
        await sendGroupedBookingEmail(ticketIds, req);
      } catch (emailErr) {
        console.error('[Webhook] Lỗi khi gửi email nhóm vé:', emailErr.message);
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

    const releasedSeats = await BookingModel.cancelBooking(ticketIds);

    // Broadcast giải phóng ghế qua Socket.IO room để giao diện các client khác cập nhật ngay lập tức
    if (releasedSeats && releasedSeats.length > 0) {
      const io = req.app.get('io');
      if (io) {
        // Nhóm các ghế bị hủy theo showtimeId
        const showtimeGroups = {};
        releasedSeats.forEach(item => {
          if (!showtimeGroups[item.showtimeId]) {
            showtimeGroups[item.showtimeId] = [];
          }
          showtimeGroups[item.showtimeId].push(item.seatId);
        });

        // Phát tán sự kiện tới từng phòng chiếu tương ứng
        for (const [stId, seatIds] of Object.entries(showtimeGroups)) {
          const room = `room_showtime_${stId}`;
          seatIds.forEach(sid => {
            io.to(room).emit('seatStatusUpdated', {
              showtimeId: parseInt(stId, 10),
              seatId: sid,
              status: 'Trống'
            });
          });
          console.log(`[Socket Broadcast] Released seats via cancel API:`, seatIds, `for showtime`, stId);
        }
      }
    }

    res.json({ success: true, message: 'Đã hủy giữ chỗ thành công.' });
  } catch (err) {
    console.error('[bookingController] cancelBooking:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server khi hủy giữ chỗ.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/bookings/public/:ticketIds
// ─────────────────────────────────────────────────────────────
exports.getPublicBookingDetails = async (req, res) => {
  try {
    const { ticketIds } = req.params;
    if (!ticketIds) {
      return res.status(400).json({ success: false, message: 'Thiếu mã vé.' });
    }

    const ids = ticketIds.split(/[- ,]+/).map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Mã vé không hợp lệ.' });
    }

    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT t.TicketID, t.Status, t.TicketPrice, t.TotalAmount, t.PaymentMethod,
             m.Title AS MovieTitle, m.PosterURL, m.Duration,
             CONVERT(varchar(19), st.StartTime, 126) + 'Z' AS StartTime,
             CONVERT(varchar(19), st.EndTime, 126) + 'Z' AS EndTime,
             r.RoomName,
             c.CinemaName, c.Address,
             s.SeatRow, s.SeatNumber, s.SeatType,
             u.FullName AS CustomerName
      FROM   Tickets t
      JOIN   Showtimes st ON t.ShowtimeID = st.ShowtimeID
      JOIN   Movies    m  ON st.MovieID   = m.MovieID
      JOIN   Rooms     r  ON st.RoomID    = r.RoomID
      JOIN   Cinemas   c  ON r.CinemaID   = c.CinemaID
      JOIN   Seats     s  ON t.SeatID     = s.SeatID
      JOIN   Users     u  ON t.UserID     = u.UserID
      WHERE  t.TicketID IN (${ids.join(',')})
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vé trong hệ thống.' });
    }

    const recordset = result.recordset;
    const first = recordset[0];
    const seatsList = recordset.map(r => `${r.SeatRow}${r.SeatNumber}`).sort();

    const ticketSum = recordset.reduce((sum, item) => sum + parseFloat(item.TotalAmount || 0), 0);

    // Lấy thông tin F&B
    const fnbResult = await pool.request().query(`
      SELECT fb.Name, tf.Quantity, fb.Price
      FROM   Ticket_FnB tf
      JOIN   FoodBeverages fb ON tf.FnBID = fb.FnBID
      WHERE  tf.TicketID IN (${ids.join(',')})
    `);

    const foodDisplayItems = fnbResult.recordset.map(item => `${item.Quantity}x ${item.Name}`);
    const fnbSum = fnbResult.recordset.reduce((sum, item) => sum + (item.Quantity * parseFloat(item.Price || 0)), 0);

    const totalAmount = ticketSum;

    res.json({
      success: true,
      data: {
        bookingId: 'DC-' + ids.sort((a, b) => a - b).join('-'),
        customerName: first.CustomerName,
        movieTitle: first.MovieTitle,
        poster: first.PosterURL,
        duration: first.Duration,
        startTime: first.StartTime,
        endTime: first.EndTime,
        roomName: first.RoomName,
        cinemaName: first.CinemaName,
        cinemaAddress: first.Address,
        seats: seatsList.join(', '),
        paymentMethod: first.PaymentMethod,
        status: first.Status,
        totalAmount: totalAmount,
        fnbTotal: fnbSum,
        ticketIds: ids.sort((a, b) => a - b),
        foodItems: foodDisplayItems.join(', ') || 'Không có'
      }
    });
  } catch (err) {
    console.error('[bookingController] getPublicBookingDetails:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server khi tìm kiếm thông tin vé.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/bookings/server-ip
// ─────────────────────────────────────────────────────────────
exports.getServerIP = (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    let candidates = [];
    for (const devName in interfaces) {
      if (/virtual|vmware|vbox|vethernet|pseudo/i.test(devName)) continue;

      const iface = interfaces[devName];
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
          const isWifi = /wi-fi|wifi|wireless|wlan/i.test(devName);
          candidates.push({ devName, ip: alias.address, isWifi });
        }
      }
    }

    candidates.sort((a, b) => (b.isWifi ? 1 : 0) - (a.isWifi ? 1 : 0));
    const ipAddress = candidates.length > 0 ? candidates[0].ip : 'localhost';
    res.json({ success: true, ip: ipAddress });
  } catch (err) {
    console.error('[bookingController] getServerIP:', err.message);
    res.json({ success: false, ip: 'localhost' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/bookings/:ticketId/request-cancel
// ─────────────────────────────────────────────────────────────
exports.requestCancelBooking = async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    if (isNaN(ticketId)) {
      return res.status(400).json({ success: false, message: 'TicketID không hợp lệ.' });
    }

    await BookingModel.cancelConfirmedBooking(ticketId, req.user.userId, req.body || {});

    res.json({ success: true, message: 'Hủy vé thành công.' });
  } catch (err) {
    console.error('[bookingController] requestCancelBooking:', err.message);
    if (
      err.message.includes('Không tìm thấy') ||
      err.message.includes('Chỉ có thể hủy') ||
      err.message.includes('Chỉ được phép hủy')
    ) {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Lỗi server khi hủy vé.' });
  }
};

exports.requestRefundBooking = async (req, res) => {
  try {
    const { ticketIds } = req.body || {};
    const created = await BookingModel.requestRefund(req.user.userId, ticketIds, req.body || {});
    res.json({
      success: true,
      message: 'Đã gửi yêu cầu hoàn tiền. Vui lòng chờ admin xử lý.',
      data: created
    });
  } catch (err) {
    console.error('[bookingController] requestRefundBooking:', err.message);
    if (
      err.message.includes('không hợp lệ') ||
      err.message.includes('Không tìm thấy') ||
      err.message.includes('Chỉ') ||
      err.message.includes('Vui lòng') ||
      err.message.includes('đã có yêu cầu')
    ) {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Lỗi server khi gửi yêu cầu hoàn tiền.' });
  }
};

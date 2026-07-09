// ============================================================
//  routes/bookingRoutes.js  –  Booking Routes
//  Tất cả routes đều yêu cầu đăng nhập (verifyToken)
// ============================================================
const express      = require('express');
const router       = express.Router();
const bookingCtrl  = require('../controllers/bookingController');
const { verifyToken, isCustomer } = require('../middleware/authMiddleware');

// GET  /api/bookings/food-beverages         — Danh sách F&B (Public)
router.get('/food-beverages',               bookingCtrl.getFoodBeverages);

// GET  /api/bookings/vouchers               — Voucher đang hoạt động (Public)
router.get('/vouchers',                     bookingCtrl.getActiveVouchers);

// GET  /api/bookings/payment-qr             — Ảnh QR thanh toán (Public)
router.get('/payment-qr',                   bookingCtrl.getPaymentQRImages);

// GET  /api/bookings/webhook                — Xác thực URL webhook với SePay (Public)
router.get('/webhook',                      bookingCtrl.verifyWebhookUrl);

// POST /api/bookings/webhook                — Webhook nhận thông báo chuyển khoản ngân hàng (Public)
router.post('/webhook',                     bookingCtrl.receivePaymentWebhook);

// GET  /api/bookings/webhook/pending        — Lấy danh sách vé đang chờ thanh toán (Public - phục vụ Simulator)
router.get('/webhook/pending',              bookingCtrl.getPendingWebhooks);

// GET  /api/bookings/public/:ticketIds        — Xem thông tin vé công khai (Public - check-in QR)
router.get('/public/:ticketIds',              bookingCtrl.getPublicBookingDetails);

// GET  /api/bookings/server-ip              — Lấy IP LAN của server để sinh mã QR check-in (Public)
router.get('/server-ip',                    bookingCtrl.getServerIP);

// Áp dụng verifyToken cho toàn bộ booking routes (trừ các routes public bên trên)
router.use(verifyToken);

// POST /api/bookings/validate-voucher       — Kiểm tra voucher
router.post('/validate-voucher',            bookingCtrl.validateVoucher);

// GET  /api/bookings/my-bookings            — Lịch sử đặt vé của tôi
router.get('/my-bookings',                  bookingCtrl.getMyBookings);

// GET  /api/bookings/check-status           — Kiểm tra trạng thái thanh toán
router.get('/check-status',                 bookingCtrl.checkBookingStatus);

// POST /api/bookings/cancel                 — Huỷ vé pending ngay lập tức
router.post('/cancel',                      bookingCtrl.cancelBooking);

// POST /api/bookings/:ticketId/request-cancel — Khách hàng yêu cầu huỷ vé đã xác nhận
router.post('/:ticketId/request-cancel',    bookingCtrl.requestCancelBooking);

// GET  /api/bookings/:ticketId              — Chi tiết một vé
router.get('/:ticketId',                    bookingCtrl.getBookingDetail);

// POST /api/bookings                        — Tạo đơn đặt vé mới
router.post('/',                            bookingCtrl.createBooking);

module.exports = router;

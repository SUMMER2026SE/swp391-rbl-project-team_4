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

// Áp dụng verifyToken cho toàn bộ booking routes (trừ food-beverages)
router.use(verifyToken);

// POST /api/bookings/validate-voucher       — Kiểm tra voucher
router.post('/validate-voucher',            bookingCtrl.validateVoucher);

// GET  /api/bookings/my-bookings            — Lịch sử đặt vé của tôi
router.get('/my-bookings',                  bookingCtrl.getMyBookings);

// GET  /api/bookings/:ticketId              — Chi tiết một vé
router.get('/:ticketId',                    bookingCtrl.getBookingDetail);

// POST /api/bookings                        — Tạo đơn đặt vé mới
router.post('/',                            bookingCtrl.createBooking);

module.exports = router;

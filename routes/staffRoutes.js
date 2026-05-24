// ============================================================
//  routes/staffRoutes.js  –  Staff Routes
//  Yêu cầu: đăng nhập + có role Staff / Manager / Admin
// ============================================================
const express    = require('express');
const router     = express.Router();
const staffCtrl  = require('../controllers/staffController');
const { verifyToken, isStaff } = require('../middleware/authMiddleware');

// Bảo vệ toàn bộ staff routes
router.use(verifyToken, isStaff);

// GET  /api/staff/showtimes/today                  — Lịch chiếu hôm nay
router.get('/showtimes/today',                      staffCtrl.getTodayShowtimes);

// GET  /api/staff/showtimes/:showtimeId/seats       — Ghế của một suất chiếu
router.get('/showtimes/:showtimeId/seats',          staffCtrl.getSeatsForSale);

// POST /api/staff/sell-ticket                       — Bán vé tại quầy
router.post('/sell-ticket',                         staffCtrl.sellTicketAtCounter);

// POST /api/staff/check-ticket                      — Kiểm tra / quét QR vé
router.post('/check-ticket',                        staffCtrl.checkTicket);

module.exports = router;

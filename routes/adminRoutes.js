// ============================================================
//  routes/adminRoutes.js  –  Admin / Manager Routes
//  Yêu cầu: đăng nhập + có role Manager hoặc Admin
// ============================================================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const adminCtrl = require('../controllers/adminController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/');
    },
    filename: function (req, file, cb) {
        cb(null, 'movie_' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Bảo vệ toàn bộ admin routes (chỉ Super Admin)
router.use(verifyToken, isSuperAdmin);

// ─── Movie Management ─────────────────────────────────────────
// POST   /api/admin/movies         — Thêm phim mới
router.post('/movies', upload.single('poster'), adminCtrl.createMovie);

// PUT    /api/admin/movies/:id      — Sửa phim
router.put('/movies/:id', upload.single('poster'), adminCtrl.updateMovie);

// GET    /api/admin/rooms           — Danh sách phòng chiếu
router.get('/rooms', adminCtrl.getRooms);

// GET    /api/admin/rooms/:id/seats — Lấy sơ đồ ghế của phòng
router.get('/rooms/:id/seats', adminCtrl.getSeatsByRoom);

// PUT    /api/admin/rooms/:id/seats — Lưu sơ đồ ghế
router.put('/rooms/:id/seats', adminCtrl.saveSeats);

// DELETE /api/admin/movies/:id      — Xóa (soft) phim
router.delete('/movies/:id', adminCtrl.deleteMovie);

// ─── Showtime Management ─────────────────────────────────────
// GET    /api/admin/showtimes       — Danh sách tất cả suất chiếu
router.get('/showtimes', adminCtrl.getAllShowtimes);

// POST   /api/admin/showtimes       — Tạo suất chiếu mới
router.post('/showtimes', adminCtrl.createShowtime);

// PUT    /api/admin/showtimes/:id   — Cập nhật suất chiếu
router.put('/showtimes/:id', adminCtrl.updateShowtime);

// DELETE /api/admin/showtimes/:id   — Hủy suất chiếu
router.delete('/showtimes/:id', adminCtrl.deleteShowtime);

// ─── User Management (chỉ Admin) ─────────────────────────────
// GET    /api/admin/users              — Danh sách người dùng
router.get('/users', adminCtrl.getAllUsers);

// PATCH  /api/admin/users/:id/role     — Đổi vai trò
router.patch('/users/:id/role', adminCtrl.changeUserRole);

// PATCH  /api/admin/users/:id/toggle-status — Khóa / mở tài khoản
router.patch('/users/:id/toggle-status', adminCtrl.toggleUserStatus);

// ─── Voucher Management ──────────────────────────────────────
// GET    /api/admin/vouchers           — Danh sách voucher
router.get('/vouchers', adminCtrl.getAllVouchers);

// POST   /api/admin/vouchers           — Tạo voucher
router.post('/vouchers', adminCtrl.createVoucher);

// PUT    /api/admin/vouchers/:id       — Sửa voucher
router.put('/vouchers/:id', adminCtrl.updateVoucher);

// DELETE /api/admin/vouchers/:id       — Xóa voucher
router.delete('/vouchers/:id', adminCtrl.deleteVoucher);

// PATCH  /api/admin/vouchers/:id/toggle — Bật/tắt trạng thái hoạt động của voucher
router.patch('/vouchers/:id/toggle', adminCtrl.toggleVoucherActive);


// ─── F&B Management ────────────────────────────────────────────
// GET    /api/admin/fnb                — Danh sách F&B
router.get('/fnb', adminCtrl.getAllFnB);

// POST   /api/admin/fnb                — Tạo mặt hàng F&B mới
router.post('/fnb', adminCtrl.createFnB);

// PUT    /api/admin/fnb/:id            — Sửa mặt hàng F&B
router.put('/fnb/:id', adminCtrl.updateFnB);

// DELETE /api/admin/fnb/:id            — Xóa mặt hàng F&B
router.delete('/fnb/:id', adminCtrl.deleteFnB);

// PATCH  /api/admin/fnb/:id/toggle     — Đổi trạng thái hiển thị
router.patch('/fnb/:id/toggle', adminCtrl.toggleFnBAvailability);

// GET    /api/admin/fnb/stats          — Số liệu thống kê FnB
router.get('/fnb/stats', adminCtrl.getFnBStats);

// ─── Statistics ──────────────────────────────────────────────
// GET    /api/admin/stats/dashboard    — Tổng quan dashboard
router.get('/stats/dashboard', adminCtrl.getDashboardStats);

// GET    /api/admin/stats/recent-transactions — Giao dịch gần đây
router.get('/stats/recent-transactions', adminCtrl.getRecentTransactions);

// GET    /api/admin/stats/revenue      — Thống kê doanh thu
router.get('/stats/revenue', adminCtrl.getRevenueStats);

// GET    /api/admin/stats/top-movies   — Top phim doanh thu cao
router.get('/stats/top-movies', adminCtrl.getTopMovies);

// GET    /api/admin/stats/monthly-revenue — Doanh thu hàng tháng cho chart
router.get('/stats/monthly-revenue', adminCtrl.getMonthlyRevenue);

// GET    /api/admin/stats/revenue-chart — Doanh thu cho biểu đồ động
router.get('/stats/revenue-chart', adminCtrl.getRevenueChartData);

// GET    /api/admin/stats/live-rooms      — Trạng thái phòng chiếu live
router.get('/stats/live-rooms', adminCtrl.getLiveRooms);

// ─── Promotions Management ──────────────────────────────────
// GET    /api/admin/promotions             — Danh sách tất cả khuyến mãi (admin)
router.get('/promotions', adminCtrl.getAllPromotions);

// GET    /api/admin/promotions/public      — Danh sách khuyến mãi đang hoạt động (public)
router.get('/promotions/public', adminCtrl.getActivePromotions);

// POST   /api/admin/promotions             — Tạo khuyến mãi mới (kèm upload ảnh)
router.post('/promotions', upload.single('image'), adminCtrl.createPromotion);

// PUT    /api/admin/promotions/:id         — Sửa khuyến mãi (kèm upload ảnh)
router.put('/promotions/:id', upload.single('image'), adminCtrl.updatePromotion);

// DELETE /api/admin/promotions/:id         — Xóa khuyến mãi
router.delete('/promotions/:id', adminCtrl.deletePromotion);

// PATCH  /api/admin/promotions/:id/toggle  — Bật/tắt trạng thái
router.patch('/promotions/:id/toggle', adminCtrl.togglePromotionActive);

module.exports = router;


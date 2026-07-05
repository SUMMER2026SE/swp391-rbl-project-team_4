// ============================================================
//  routes/adminRoutes.js  –  Admin / Manager Routes
//  Yêu cầu: đăng nhập + có role Manager hoặc Admin
// ============================================================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const adminCtrl = require('../controllers/adminController');
const comboCtrl = require('../controllers/comboController');
const newsCtrl = require('../controllers/newsController');
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

// Movie review management
router.get('/movie-reviews', adminCtrl.getMovieReviews);
router.patch('/movie-reviews/:id/toggle', adminCtrl.toggleMovieReview);
router.delete('/movie-reviews/:id', adminCtrl.deleteMovieReview);

router.get('/genres', adminCtrl.getGenres);
router.post('/genres', adminCtrl.createGenre);
router.put('/genres/:id', adminCtrl.updateGenre);
router.patch('/genres/:id/toggle', adminCtrl.toggleGenre);
router.delete('/genres/:id', adminCtrl.deleteGenre);

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
router.post('/fnb', upload.single('image'), adminCtrl.createFnB);

// PUT    /api/admin/fnb/:id            — Sửa mặt hàng F&B
router.put('/fnb/:id', upload.single('image'), adminCtrl.updateFnB);

// DELETE /api/admin/fnb/:id            — Xóa mặt hàng F&B
router.delete('/fnb/:id', adminCtrl.deleteFnB);

// PATCH  /api/admin/fnb/:id/toggle     — Đổi trạng thái hiển thị
router.patch('/fnb/:id/toggle', adminCtrl.toggleFnBAvailability);

// GET    /api/admin/fnb/stats          — Số liệu thống kê FnB
router.get('/fnb/stats', adminCtrl.getFnBStats);

// ─── Combo Management ──────────────────────────────────────────
// GET    /api/admin/combos             — Danh sách combo
router.get('/combos', comboCtrl.getAllCombos);

// POST   /api/admin/combos             — Tạo combo mới (kèm upload ảnh)
router.post('/combos', upload.single('image'), comboCtrl.createCombo);

// PUT    /api/admin/combos/:id         — Sửa combo (kèm upload ảnh)
router.put('/combos/:id', upload.single('image'), comboCtrl.updateCombo);

// DELETE /api/admin/combos/:id         — Xóa (soft) combo
router.delete('/combos/:id', comboCtrl.deleteCombo);

// PATCH  /api/admin/combos/:id/toggle  — Bật/tắt trạng thái hoạt động của combo
router.patch('/combos/:id/toggle', comboCtrl.toggleComboStatus);

// ─── Statistics ──────────────────────────────────────────────
// ─── Cinema Management ──────────────────────────────────────
// GET    /api/admin/cinemas           — Danh sách rạp chiếu
router.get('/cinemas', adminCtrl.getCinemas);

// POST   /api/admin/cinemas           — Thêm rạp mới
router.post('/cinemas', adminCtrl.createCinema);

// PUT    /api/admin/cinemas/:id       — Sửa rạp
router.put('/cinemas/:id', adminCtrl.updateCinema);

// DELETE /api/admin/cinemas/:id       — Xóa rạp
router.delete('/cinemas/:id', adminCtrl.deleteCinema);

// ─── Room Management ────────────────────────────────────────
// POST   /api/admin/rooms             — Thêm phòng chiếu
router.post('/rooms', adminCtrl.createRoom);

// PUT    /api/admin/rooms/:id         — Sửa phòng chiếu
router.put('/rooms/:id', adminCtrl.updateRoom);

// DELETE /api/admin/rooms/:id         — Xóa phòng chiếu
router.delete('/rooms/:id', adminCtrl.deleteRoom);

// GET    /api/admin/stats/dashboard    — Tổng quan dashboard (hỗ trợ ?cinemaId=&period=)
router.get('/stats/dashboard', adminCtrl.getDashboardStats);

// GET    /api/admin/stats/recent-transactions — Giao dịch gần đây
router.get('/stats/recent-transactions', adminCtrl.getRecentTransactions);

// GET    /api/admin/stats/export-pdf   — Xuất báo cáo PDF
router.get('/stats/export-pdf', adminCtrl.exportPdf);

// GET    /api/admin/stats/export-csv   — Xuất báo cáo CSV
router.get('/stats/export-csv', adminCtrl.exportCsv);

// GET    /api/admin/stats/export-excel — Xuất báo cáo Excel
router.get('/stats/export-excel', adminCtrl.exportExcel);

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

// News article management
router.get('/news', newsCtrl.getAdminArticles);
router.post('/news', upload.single('image'), newsCtrl.createArticle);
router.put('/news/:id', upload.single('image'), newsCtrl.updateArticle);
router.delete('/news/:id', newsCtrl.deleteArticle);
router.patch('/news/:id/toggle', newsCtrl.toggleArticleActive);


// ==========================================
// SYSTEM SETTINGS
// ==========================================
const settingsController = require('../controllers/settingsController');
router.get('/settings', settingsController.getAllSettings);
router.put('/settings', settingsController.updateSettings);

module.exports = router;


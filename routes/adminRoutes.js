// ============================================================
//  routes/adminRoutes.js  –  Admin / Manager Routes
//  Yêu cầu: đăng nhập + có role Manager hoặc Admin
// ============================================================
const express    = require('express');
const router     = express.Router();
const adminCtrl  = require('../controllers/adminController');
const { verifyToken, isManager, isAdmin } = require('../middleware/authMiddleware');

// Bảo vệ toàn bộ admin routes (ít nhất phải là Manager)
router.use(verifyToken, isManager);

// ─── Movie Management ─────────────────────────────────────────
// POST   /api/admin/movies         — Thêm phim mới
router.post('/movies',                      adminCtrl.createMovie);

// PUT    /api/admin/movies/:id      — Sửa phim
router.put('/movies/:id',                   adminCtrl.updateMovie);

// DELETE /api/admin/movies/:id      — Xóa (soft) phim (chỉ Admin)
router.delete('/movies/:id',   isAdmin,     adminCtrl.deleteMovie);

// ─── Showtime Management ─────────────────────────────────────
// GET    /api/admin/showtimes       — Danh sách tất cả suất chiếu
router.get('/showtimes',                    adminCtrl.getAllShowtimes);

// POST   /api/admin/showtimes       — Tạo suất chiếu mới
router.post('/showtimes',                   adminCtrl.createShowtime);

// PUT    /api/admin/showtimes/:id   — Cập nhật suất chiếu
router.put('/showtimes/:id',               adminCtrl.updateShowtime);

// ─── User Management (chỉ Admin) ─────────────────────────────
// GET    /api/admin/users              — Danh sách người dùng
router.get('/users',          isAdmin,     adminCtrl.getAllUsers);

// PATCH  /api/admin/users/:id/role     — Đổi vai trò
router.patch('/users/:id/role', isAdmin,  adminCtrl.changeUserRole);

// PATCH  /api/admin/users/:id/toggle-status — Khóa / mở tài khoản
router.patch('/users/:id/toggle-status', isAdmin, adminCtrl.toggleUserStatus);

// ─── Voucher Management ──────────────────────────────────────
// GET    /api/admin/vouchers           — Danh sách voucher
router.get('/vouchers',                    adminCtrl.getAllVouchers);

// POST   /api/admin/vouchers           — Tạo voucher
router.post('/vouchers',                   adminCtrl.createVoucher);

// ─── Statistics ──────────────────────────────────────────────
// GET    /api/admin/stats/dashboard    — Tổng quan dashboard
router.get('/stats/dashboard',            adminCtrl.getDashboardStats);

// GET    /api/admin/stats/revenue      — Thống kê doanh thu
router.get('/stats/revenue',             adminCtrl.getRevenueStats);

// GET    /api/admin/stats/top-movies   — Top phim doanh thu cao
router.get('/stats/top-movies',          adminCtrl.getTopMovies);

module.exports = router;

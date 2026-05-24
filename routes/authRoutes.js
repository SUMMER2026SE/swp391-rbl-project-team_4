// ============================================================
//  routes/authRoutes.js  –  Authentication Routes
// ============================================================
const express    = require('express');
const router     = express.Router();
const authCtrl   = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// POST /api/auth/register  — Đăng ký tài khoản mới (Customer)
router.post('/register', authCtrl.register);

// POST /api/auth/login     — Đăng nhập, nhận JWT
router.post('/login', authCtrl.login);

// GET  /api/auth/me        — Xem thông tin user hiện tại (cần token)
router.get('/me', verifyToken, authCtrl.getMe);

module.exports = router;

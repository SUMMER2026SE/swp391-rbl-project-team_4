// ============================================================
//  routes/authRoutes.js  –  Authentication API Endpoints
// ============================================================
const express = require('express');
const router = express.Router();
const { register, login, googleLogin } = require('../controllers/authController');

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/register
//  Body: { fullName, email, password, phone? }
//  Tạo tài khoản mới với role mặc định là 'Customer'
// ─────────────────────────────────────────────────────────────
router.post('/register', register);

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/login
//  Body: { email, password }
//  Trả về JWT token nếu xác thực thành công
// ─────────────────────────────────────────────────────────────
router.post('/login', login);

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/google
//  Body: { credential }
//  Google OAuth login/register
// ─────────────────────────────────────────────────────────────
router.post('/google', googleLogin);

module.exports = router;

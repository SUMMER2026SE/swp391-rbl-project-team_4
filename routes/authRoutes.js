// ============================================================
//  routes/authRoutes.js  –  Authentication API Endpoints
// ============================================================
const express = require('express');
const router = express.Router();
const {
  register,
  login,
  googleLogin,
  forgotPassword,
  verifyOTP,
  resetPassword,
} = require('../controllers/authController');

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

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/forgot-password
//  Body: { email }  — email hoặc số điện thoại
//  Tạo OTP 6 số → gửi qua Email hoặc SMS
// ─────────────────────────────────────────────────────────────
router.post('/forgot-password', forgotPassword);

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/verify-otp
//  Body: { email, otp }
//  Xác minh mã OTP → trả về resetToken
// ─────────────────────────────────────────────────────────────
router.post('/verify-otp', verifyOTP);

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/reset-password
//  Body: { resetToken, newPassword }
//  Đặt lại mật khẩu mới
// ─────────────────────────────────────────────────────────────
router.post('/reset-password', resetPassword);

module.exports = router;

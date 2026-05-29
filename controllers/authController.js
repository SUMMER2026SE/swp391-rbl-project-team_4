// ============================================================
//  controllers/authController.js  –  Đăng ký & Đăng nhập (MVC Refactored)
// ============================================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const AuthModel = require('../models/authModel');
const UserModel = require('../models/userModel');
const { sendOTPEmail } = require('../services/emailService');

// Giả định bạn đã export JWT_SECRET từ authMiddleware hoặc process.env
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '680237511336-g14sn1oitjn8atqlgi9316g82avcjaqo.apps.googleusercontent.com';

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d'; // Token hết hạn sau 7 ngày

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/register
// ─────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ: fullName, email, password.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    const existCheck = await AuthModel.checkEmailExist(email);
    if (existCheck) {
      return res.status(409).json({ success: false, message: 'Email này đã được đăng ký.' });
    }

    const roleId = await AuthModel.getRoleIdByName('Customer');
    if (!roleId) {
      return res.status(500).json({ success: false, message: 'Không tìm thấy vai trò Customer trong CSDL.' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await AuthModel.createUser({ fullName, email, hashedPassword, phone, roleId });

    const token = jwt.sign(
      { userId: newUser.UserID, email: newUser.Email, roleId: roleId, roleName: 'Customer' },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return res.status(201).json({
      success: true,
      message: 'Đăng ký thành công!',
      token,
      user: {
        userId: newUser.UserID,
        fullName: newUser.FullName,
        email: newUser.Email,
        roleId: roleId,
        roleName: 'Customer'
      },
    });
  } catch (err) {
    console.error('[authController] register:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/login
// ─────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email và password.' });
    }

    const user = await AuthModel.findUserByEmailWithRole(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }

    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }

    const token = jwt.sign(
      { userId: user.UserID, email: user.Email, roleId: user.RoleID, roleName: user.RoleName },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: {
        userId: user.UserID,
        fullName: user.FullName,
        email: user.Email,
        phone: user.Phone,
        roleId: user.RoleID,
        roleName: user.RoleName,
        AvatarURL: user.AvatarURL,
      },
    });
  } catch (err) {
    console.error('[authController] login:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/auth/me   
// ─────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await AuthModel.findUserByIdWithRole(req.user.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    res.json({
      success: true,
      data: {
        userId: user.UserID,
        fullName: user.FullName,
        email: user.Email,
        phone: user.Phone,
        roleId: user.RoleID,
        roleName: user.RoleName,
        createdAt: user.CreatedAt,
      },
    });
  } catch (err) {
    console.error('[authController] getMe:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/google
// ─────────────────────────────────────────────────────────────
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp Google credential.' });
    }

    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (err) {
      console.error('[authController] Google verify error:', err.message);
      return res.status(401).json({ success: false, message: 'Google token không hợp lệ.' });
    }

    const payload = ticket.getPayload();
    const email = payload.email;
    const fullName = payload.name || 'Google User';

    const existCheck = await AuthModel.checkEmailExist(email);
    let user, token;

    if (existCheck) {
      user = await AuthModel.findUserByIdWithRole(existCheck.UserID);
      if (!user) return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });

      token = jwt.sign(
        { userId: user.UserID, email: user.Email, roleId: user.RoleID, roleName: user.RoleName },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        message: 'Đăng nhập Google thành công!',
        token,
        user: {
          userId: user.UserID,
          fullName: user.FullName,
          email: user.Email,
          phone: user.Phone,
          roleId: user.RoleID,
          roleName: user.RoleName,
        },
      });

    } else {
      const roleId = await AuthModel.getRoleIdByName('Customer');
      if (!roleId) return res.status(500).json({ success: false, message: 'Không tìm thấy vai trò Customer.' });

      const randomPassword = Math.random().toString(36).slice(-15);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const newUser = await AuthModel.createUser({ fullName, email, hashedPassword, phone: null, roleId });

      token = jwt.sign(
        { userId: newUser.UserID, email: newUser.Email, roleId: roleId, roleName: 'Customer' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        success: true,
        message: 'Đăng ký Google thành công!',
        token,
        user: {
          userId: newUser.UserID,
          fullName: newUser.FullName,
          email: newUser.Email,
          roleId: roleId,
          roleName: 'Customer',
        },
      });
    }

  } catch (err) {
    console.error('[authController] googleLogin:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email.' });

    const input = email.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    if (!isEmail) return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });

    const user = await AuthModel.checkEmailExist(input);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này.' });

    await AuthModel.deleteUnusedOTP(user.UserID);

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otpCode, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    await AuthModel.createOTP(user.UserID, otpHash, expiresAt);

    try {
      await sendOTPEmail(input, otpCode);
    } catch (sendErr) {
      console.error('[authController] OTP send error:', sendErr.message);
      return res.status(500).json({ success: false, message: 'Không thể gửi mã OTP qua email. Vui lòng thử lại sau.' });
    }

    return res.json({
      success: true,
      message: 'Mã OTP đã được gửi đến email của bạn.',
      method: 'email',
    });

  } catch (err) {
    console.error('[authController] forgotPassword:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/verify-otp
// ─────────────────────────────────────────────────────────────
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email và mã OTP.' });

    const input = email.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    if (!isEmail) return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });

    const user = await AuthModel.checkEmailExist(input);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });

    const resetRecord = await AuthModel.getLatestUnusedOTP(user.UserID);
    if (!resetRecord) {
      return res.status(400).json({ success: false, message: 'Mã OTP đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu mã mới.' });
    }

    const isMatch = await bcrypt.compare(otp, resetRecord.OTPHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mã OTP không đúng. Vui lòng kiểm tra lại.' });
    }

    await AuthModel.markOTPAsUsed(resetRecord.ResetID);

    const resetToken = jwt.sign(
      { userId: user.UserID, purpose: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.json({
      success: true,
      message: 'Xác minh OTP thành công!',
      resetToken,
    });

  } catch (err) {
    console.error('[authController] verifyOTP:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp resetToken và mật khẩu mới.' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });

    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({ success: false, message: 'Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu lại.' });
    }

    if (decoded.purpose !== 'password-reset') {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    // Sử dụng hàm UserModel đã viết thay vì viết lại ở AuthModel
    await UserModel.updatePassword(decoded.userId, hashedPassword);
    await AuthModel.deleteAllOTPs(decoded.userId);

    return res.json({
      success: true,
      message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.',
    });

  } catch (err) {
    console.error('[authController] resetPassword:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};
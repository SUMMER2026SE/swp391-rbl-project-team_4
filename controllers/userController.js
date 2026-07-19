// ============================================================
//  controllers/userController.js  –  User Profile API (MVC Refactored)
// ============================================================
const UserModel = require('../models/userModel');
const RewardModel = require('../models/rewardModel');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

function validatePasswordPolicy(password) {
  if (!password || password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (!/^[A-Z]/.test(password)) return 'Chữ cái đầu tiên phải viết hoa.';
  if (!/\d/.test(password)) return 'Mật khẩu phải chứa ít nhất 1 chữ số.';
  if (!/[._!@#$%^&*()\-+=<>?]/.test(password)) return 'Mật khẩu phải chứa ký tự đặc biệt (VD: ., _, @).';
  return null;
}

function normalizeVietnamPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return digits;
}

function validateVietnamPhone(phone) {
  if (!phone) return true;
  return /^0\d{9}$/.test(normalizeVietnamPhone(phone));
}

// ─────────────────────────────────────────────────────────────
// GET /api/users/profile
// Get current user profile information
// ─────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    res.json({
      success: true,
      user
    });
  } catch (err) {
    console.error('[userController] getProfile:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/users/profile
// Update user profile information
// ─────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fullName, phone, dateOfBirth, address } = req.body;
    const normalizedPhone = phone ? normalizeVietnamPhone(phone) : null;

    if (!validateVietnamPhone(phone)) {
      return res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ. Vui lòng nhập số Việt Nam gồm 10 chữ số.' });
    }

    if (normalizedPhone) {
      const phoneCheck = await UserModel.checkPhoneExist(normalizedPhone, userId);
      if (phoneCheck) {
        return res.status(409).json({ success: false, message: 'Số điện thoại này đã được dùng bởi tài khoản khác.' });
      }
    }

    await UserModel.updateProfile(userId, { 
      fullName, 
      phone: normalizedPhone, 
      dob: dateOfBirth, 
      address 
    });

    res.json({ success: true, message: 'Cập nhật hồ sơ thành công.' });
  } catch (err) {
    console.error('[userController] updateProfile:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/users/password
// Update user password
// ─────────────────────────────────────────────────────────────
exports.updatePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mật khẩu cũ và mới.' });
    }
    const passwordError = validatePasswordPolicy(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    const currentHash = await UserModel.getPasswordHash(userId);

    if (!currentHash) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    // Kiểm tra mật khẩu cũ
    const isMatch = await bcrypt.compare(oldPassword, currentHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Mật khẩu cũ không chính xác.' });
    }

    // Hash mật khẩu mới và cập nhật
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await UserModel.updatePassword(userId, hashedNewPassword);

    res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
  } catch (err) {
    console.error('[userController] updatePassword:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/users/avatar
// Update user avatar
// ─────────────────────────────────────────────────────────────
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn một file ảnh.' });
    }

    const userId = req.user.userId;
    const avatarUrl = '/uploads/avatars/' + req.file.filename;
    
    await UserModel.updateAvatar(userId, avatarUrl);

    res.json({
      success: true,
      message: 'Cập nhật ảnh đại diện thành công.',
      avatarUrl
    });
  } catch (err) {
    console.error('[userController] uploadAvatar:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server khi upload ảnh.' });
  }
};

exports.getRewards = async (req, res) => {
  try {
    const data = await RewardModel.getSummary(req.user.userId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('[userController] getRewards:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server khi tải điểm thưởng.' });
  }
};

exports.redeemReward = async (req, res) => {
  try {
    const { rewardId } = req.body || {};
    const data = await RewardModel.redeemReward(req.user.userId, rewardId);
    res.status(201).json({
      success: true,
      message: 'Đổi điểm thành công.',
      data,
    });
  } catch (err) {
    console.error('[userController] redeemReward:', err.message);
    const status = /không hợp lệ|cần|Không tìm thấy/i.test(err.message) ? 400 : 500;
    res.status(status).json({ success: false, message: err.message || 'Lỗi server khi đổi điểm.' });
  }
};

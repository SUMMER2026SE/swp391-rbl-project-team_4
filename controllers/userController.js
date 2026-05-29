// ============================================================
//  controllers/userController.js  –  User Profile API (MVC Refactored)
// ============================================================
const UserModel = require('../models/userModel');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

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

    await UserModel.updateProfile(userId, { 
      fullName, 
      phone, 
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

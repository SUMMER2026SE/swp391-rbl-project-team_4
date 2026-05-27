// ============================================================
//  controllers/userController.js  –  User Profile API
// ============================================================
const { sql, getPool } = require('../config/db');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

// ─────────────────────────────────────────────────────────────
// GET /api/users/profile
// Get current user profile information
// ─────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = await getPool();

    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT UserID, FullName, Email, Phone, CreatedAt, DOB, Address, RewardPoints, AvatarURL
        FROM Users
        WHERE UserID = @userId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const user = result.recordset[0];
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
    const pool = await getPool();

    await pool.request()
      .input('userId', sql.Int, userId)
      .input('fullName', sql.NVarChar, fullName || null)
      .input('phone', sql.NVarChar, phone || null)
      .input('dob', sql.Date, dateOfBirth || null)
      .input('address', sql.NVarChar, address || null)
      .query(`
        UPDATE Users 
        SET FullName = COALESCE(@fullName, FullName),
            Phone = COALESCE(@phone, Phone),
            DOB = COALESCE(@dob, DOB),
            Address = COALESCE(@address, Address)
        WHERE UserID = @userId
      `);

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

    const pool = await getPool();

    // Lấy mật khẩu cũ từ DB
    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT PasswordHash FROM Users WHERE UserID = @userId');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const currentHash = userResult.recordset[0].PasswordHash;

    // Kiểm tra mật khẩu cũ
    const isMatch = await bcrypt.compare(oldPassword, currentHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Mật khẩu cũ không chính xác.' });
    }

    // Hash mật khẩu mới và cập nhật
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await pool.request()
      .input('userId', sql.Int, userId)
      .input('newPasswordHash', sql.NVarChar, hashedNewPassword)
      .query('UPDATE Users SET PasswordHash = @newPasswordHash WHERE UserID = @userId');

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
    // req.file.path may have backslashes on windows, normalize it
    const avatarUrl = '/uploads/avatars/' + req.file.filename;
    
    const pool = await getPool();
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('avatarUrl', sql.NVarChar, avatarUrl)
      .query(`
        UPDATE Users
        SET AvatarURL = @avatarUrl
        WHERE UserID = @userId
      `);

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

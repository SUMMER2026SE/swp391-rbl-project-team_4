// ============================================================
//  controllers/authController.js  –  Đăng ký & Đăng nhập
// ============================================================
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { getPool, sql } = require('../config/db');
const { JWT_SECRET }   = require('../middleware/authMiddleware');

const SALT_ROUNDS  = 10;
const TOKEN_EXPIRY = '7d'; // Token hết hạn sau 7 ngày

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/register
//  Body: { fullName, email, password, phone? }
//  Mặc định tạo tài khoản với Role = 'Customer'
// ─────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body;

    // --- Validation cơ bản ---
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ: fullName, email, password.',
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự.',
      });
    }

    const pool = await getPool();

    // --- Kiểm tra email đã tồn tại chưa ---
    const existCheck = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT UserID FROM Users WHERE Email = @email');

    if (existCheck.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email này đã được đăng ký.',
      });
    }

    // --- Lấy RoleID cho 'Customer' ---
    const roleResult = await pool.request()
      .input('roleName', sql.NVarChar, 'Customer')
      .query('SELECT RoleID FROM Roles WHERE RoleName = @roleName');

    if (roleResult.recordset.length === 0) {
      return res.status(500).json({ success: false, message: 'Không tìm thấy vai trò Customer.' });
    }
    const roleId = roleResult.recordset[0].RoleID;

    // --- Hash password & lưu vào DB ---
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const insertResult = await pool.request()
      .input('fullName',       sql.NVarChar,  fullName)
      .input('email',          sql.NVarChar,  email)
      .input('hashedPassword', sql.NVarChar,  hashedPassword)
      .input('phone',          sql.NVarChar,  phone || null)
      .input('roleId',         sql.Int,       roleId)
      .query(`
        INSERT INTO Users (FullName, Email, PasswordHash, Phone, RoleID, CreatedAt)
        OUTPUT INSERTED.UserID, INSERTED.FullName, INSERTED.Email
        VALUES (@fullName, @email, @hashedPassword, @phone, @roleId, GETDATE())
      `);

    const newUser = insertResult.recordset[0];

    // --- Tạo JWT ---
    const token = jwt.sign(
      { userId: newUser.UserID, email: newUser.Email, role: 'Customer' },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return res.status(201).json({
      success: true,
      message: 'Đăng ký thành công!',
      token,
      user: { userId: newUser.UserID, fullName: newUser.FullName, email: newUser.Email, role: 'Customer' },
    });
  } catch (err) {
    console.error('[authController] register:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/login
//  Body: { email, password }
//  Trả về JWT nếu thành công
// ─────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp email và password.',
      });
    }

    const pool = await getPool();

    // --- Tìm user và join role ---
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT u.UserID, u.FullName, u.Email, u.PasswordHash, u.Phone, u.IsActive,
               r.RoleName
        FROM   Users u
        JOIN   Roles r ON u.RoleID = r.RoleID
        WHERE  u.Email = @email
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }

    const user = result.recordset[0];

    // --- Kiểm tra tài khoản bị khóa ---
    if (user.IsActive === false) {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị vô hiệu hóa.' });
    }

    // --- Kiểm tra password ---
    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }

    // --- Tạo JWT ---
    const token = jwt.sign(
      { userId: user.UserID, email: user.Email, role: user.RoleName },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: {
        userId:   user.UserID,
        fullName: user.FullName,
        email:    user.Email,
        phone:    user.Phone,
        role:     user.RoleName,
      },
    });
  } catch (err) {
    console.error('[authController] login:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/auth/me   (yêu cầu Bearer Token)
//  Trả về thông tin user hiện tại
// ─────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT u.UserID, u.FullName, u.Email, u.Phone, u.CreatedAt,
               r.RoleName
        FROM   Users u
        JOIN   Roles r ON u.RoleID = r.RoleID
        WHERE  u.UserID = @userId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const user = result.recordset[0];
    res.json({
      success: true,
      data: {
        userId:    user.UserID,
        fullName:  user.FullName,
        email:     user.Email,
        phone:     user.Phone,
        role:      user.RoleName,
        createdAt: user.CreatedAt,
      },
    });
  } catch (err) {
    console.error('[authController] getMe:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ============================================================
//  controllers/authController.js  –  Đăng ký & Đăng nhập
// ============================================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { getPool, sql } = require('../config/db');
// Giả định bạn đã export JWT_SECRET từ authMiddleware hoặc process.env
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '680237511336-g14sn1oitjn8atqlgi9316g82avcjaqo.apps.googleusercontent.com';

const SALT_ROUNDS = 10;
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
      return res.status(500).json({ success: false, message: 'Không tìm thấy vai trò Customer trong CSDL.' });
    }
    const roleId = roleResult.recordset[0].RoleID;

    // --- Hash password & lưu vào DB ---
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const insertResult = await pool.request()
      .input('fullName', sql.NVarChar, fullName)
      .input('email', sql.NVarChar, email)
      .input('hashedPassword', sql.NVarChar, hashedPassword)
      .input('phone', sql.NVarChar, phone || null)
      .input('roleId', sql.Int, roleId)
      .query(`
        INSERT INTO Users (FullName, Email, PasswordHash, Phone, RoleID, CreatedAt)
        OUTPUT INSERTED.UserID, INSERTED.FullName, INSERTED.Email
        VALUES (@fullName, @email, @hashedPassword, @phone, @roleId, GETDATE())
      `);

    const newUser = insertResult.recordset[0];

    // --- Tạo JWT (Gói thêm roleId để Frontend dễ xử lý) ---
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

    // --- Tìm user và join role (ĐÃ XÓA u.IsActive ĐỂ KHỚP DATABASE) ---
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT u.UserID, u.FullName, u.Email, u.PasswordHash, u.Phone, u.RoleID,
               r.RoleName
        FROM   Users u
        JOIN   Roles r ON u.RoleID = r.RoleID
        WHERE  u.Email = @email
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }

    const user = result.recordset[0];

    // --- Kiểm tra password ---
    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }

    // --- Tạo JWT ---
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
    // req.user được gán từ authMiddleware (hàm verifyToken)
    const result = await pool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT u.UserID, u.FullName, u.Email, u.Phone, u.CreatedAt, u.RoleID,
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
//  Body: { credential }
//  Xác minh Google token & đăng nhập / đăng ký user
// ─────────────────────────────────────────────────────────────
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp Google credential.',
      });
    }

    // Xác minh Google token
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (err) {
      console.error('[authController] Google verify error:', err.message);
      return res.status(401).json({
        success: false,
        message: 'Google token không hợp lệ.',
      });
    }

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const fullName = payload.name || 'Google User';

    const pool = await getPool();

    // --- Kiểm tra user đã tồn tại chưa ---
    const existCheck = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT UserID, RoleID FROM Users WHERE Email = @email');

    let user, token;

    if (existCheck.recordset.length > 0) {
      // User đã tồn tại → Đăng nhập
      const existUser = existCheck.recordset[0];

      const userDetail = await pool.request()
        .input('userId', sql.Int, existUser.UserID)
        .query(`
          SELECT u.UserID, u.FullName, u.Email, u.Phone, u.RoleID,
                 r.RoleName
          FROM   Users u
          JOIN   Roles r ON u.RoleID = r.RoleID
          WHERE  u.UserID = @userId
        `);

      if (userDetail.recordset.length === 0) {
        return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
      }

      user = userDetail.recordset[0];
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
      // User chưa tồn tại → Đăng ký tự động với role Customer
      const roleResult = await pool.request()
        .input('roleName', sql.NVarChar, 'Customer')
        .query('SELECT RoleID FROM Roles WHERE RoleName = @roleName');

      if (roleResult.recordset.length === 0) {
        return res.status(500).json({ success: false, message: 'Không tìm thấy vai trò Customer.' });
      }

      const roleId = roleResult.recordset[0].RoleID;

      // Hash mật khẩu ngẫu nhiên (Google login không dùng password)
      const randomPassword = Math.random().toString(36).slice(-15);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const insertResult = await pool.request()
        .input('fullName', sql.NVarChar, fullName)
        .input('email', sql.NVarChar, email)
        .input('hashedPassword', sql.NVarChar, hashedPassword)
        .input('roleId', sql.Int, roleId)
        .query(`
          INSERT INTO Users (FullName, Email, PasswordHash, RoleID, CreatedAt)
          OUTPUT INSERTED.UserID, INSERTED.FullName, INSERTED.Email
          VALUES (@fullName, @email, @hashedPassword, @roleId, GETDATE())
        `);

      const newUser = insertResult.recordset[0];

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
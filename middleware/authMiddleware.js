// ============================================================
//  middleware/authMiddleware.js  –  JWT Verify & Role Guard
// ============================================================
const jwt = require('jsonwebtoken');

// Lấy secret key từ biến môi trường (Nên khai báo trong file .env)
const JWT_SECRET = process.env.JWT_SECRET || 'cinemaverse_super_secret_key_2024';

// ─── Vai trò (Phải khớp chính xác với dữ liệu trong bảng Roles) ──
const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  CUSTOMER: 'Customer',
};

/**
 * verifyToken
 * Middleware xác thực JWT từ header Authorization: Bearer <token>
 * Sau khi xác thực, gắn req.user = { userId, email, roleId, roleName }
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Không có token. Vui lòng đăng nhập.',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    // Giải mã token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Object payload lưu từ authController { userId, email, roleId, roleName, iat, exp }
    next(); // Cho phép đi tiếp vào Controller
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token đã hết hạn. Vui lòng đăng nhập lại.' });
    }
    return res.status(401).json({ success: false, message: 'Token không hợp lệ.' });
  }
};

/**
 * authorizeRoles(...roles)
 * Factory middleware — chỉ cho phép những vai trò được liệt kê
 * Ví dụ: authorizeRoles('Super Admin')
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // Phải chạy verifyToken trước thì req.user mới tồn tại
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    }

    // Kiểm tra xem roleName trong token có nằm trong mảng quyền cho phép không
    if (!roles.includes(req.user.roleName)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền truy cập. Yêu cầu vai trò: ${roles.join(', ')}.`,
      });
    }
    next();
  };
};

// ============================================================
// Shorthand guards cho dự án B2C
// ============================================================

// Chỉ Super Admin mới gọi được API này (Dùng cho Xóa phim, Thêm lịch chiếu, v.v.)
const isSuperAdmin = authorizeRoles(ROLES.SUPER_ADMIN);

// Tùy chọn: Dùng nếu có API chỉ dành riêng cho Customer (Dùng cho Đặt vé, Viết review, v.v.)
const isCustomer = authorizeRoles(ROLES.CUSTOMER);

module.exports = {
  ROLES,
  JWT_SECRET,
  verifyToken,
  authorizeRoles,
  isSuperAdmin,
  isCustomer,
};
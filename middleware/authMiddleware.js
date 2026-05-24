// ============================================================
//  middleware/authMiddleware.js  –  JWT Verify & Role Guard
// ============================================================
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cinemaverse_super_secret_key_2024';

// ─── Vai trò (phải trùng với cột RoleName trong bảng Roles) ──
const ROLES = {
  ADMIN:    'Admin',
  MANAGER:  'Manager',
  STAFF:    'Staff',
  CUSTOMER: 'Customer',
};

/**
 * verifyToken
 * Middleware xác thực JWT từ header Authorization: Bearer <token>
 * Sau khi xác thực, gắn req.user = { userId, email, role }
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
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, email, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token đã hết hạn.' });
    }
    return res.status(401).json({ success: false, message: 'Token không hợp lệ.' });
  }
};

/**
 * authorizeRoles(...roles)
 * Factory middleware — chỉ cho phép những vai trò được liệt kê
 * Ví dụ: authorizeRoles('Admin', 'Manager')
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền truy cập. Yêu cầu vai trò: ${roles.join(', ')}.`,
      });
    }
    next();
  };
};

// Shorthand guards cho từng role cụ thể
const isAdmin    = authorizeRoles(ROLES.ADMIN);
const isManager  = authorizeRoles(ROLES.ADMIN, ROLES.MANAGER);
const isStaff    = authorizeRoles(ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF);
const isCustomer = authorizeRoles(ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF, ROLES.CUSTOMER);

module.exports = {
  ROLES,
  JWT_SECRET,
  verifyToken,
  authorizeRoles,
  isAdmin,
  isManager,
  isStaff,
  isCustomer,
};

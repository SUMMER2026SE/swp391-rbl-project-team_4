// ============================================================
//  controllers/adminController.js  –  Admin / Manager APIs (MVC Refactored)
//  Dành cho: Quản lý (Role: Admin, Manager)
// ============================================================
const AdminModel = require('../models/adminModel');

// ════════════════════════════════════════════════════════════
//  MOVIE MANAGEMENT
// ════════════════════════════════════════════════════════════

exports.createMovie = async (req, res) => {
  try {
    const { title, genre, duration, releaseDate } = req.body;
    if (!title || !genre || !duration || !releaseDate) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: title, genre, duration, releaseDate.' });
    }

    const movie = await AdminModel.createMovie(req.body);
    res.status(201).json({ success: true, message: 'Thêm phim thành công!', data: movie });
  } catch (err) {
    console.error('[adminController] createMovie:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.updateMovie = async (req, res) => {
  try {
    const movie = await AdminModel.updateMovie(parseInt(req.params.id), req.body);
    if (!movie) return res.status(404).json({ success: false, message: 'Không tìm thấy phim.' });
    
    res.json({ success: true, message: 'Cập nhật phim thành công!', data: movie });
  } catch (err) {
    console.error('[adminController] updateMovie:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.deleteMovie = async (req, res) => {
  try {
    await AdminModel.deleteMovie(parseInt(req.params.id));
    res.json({ success: true, message: 'Đã xóa phim.' });
  } catch (err) {
    console.error('[adminController] deleteMovie:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ════════════════════════════════════════════════════════════
//  SHOWTIME MANAGEMENT
// ════════════════════════════════════════════════════════════

exports.getAllShowtimes = async (req, res) => {
  try {
    const data = await AdminModel.getAllShowtimes(req.query);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[adminController] getAllShowtimes:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.createShowtime = async (req, res) => {
  try {
    const { movieId, roomId, startTime, endTime, price } = req.body;
    if (!movieId || !roomId || !startTime || !endTime || price == null) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin: movieId, roomId, startTime, endTime, price.' });
    }

    const showtime = await AdminModel.createShowtime(req.body);
    res.status(201).json({ success: true, message: 'Tạo suất chiếu thành công!', data: showtime });
  } catch (err) {
    console.error('[adminController] createShowtime:', err.message);
    if (err.message.includes('đã có lịch')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.updateShowtime = async (req, res) => {
  try {
    const showtime = await AdminModel.updateShowtime(parseInt(req.params.id), req.body);
    if (!showtime) return res.status(404).json({ success: false, message: 'Không tìm thấy suất chiếu.' });

    res.json({ success: true, message: 'Cập nhật suất chiếu thành công!', data: showtime });
  } catch (err) {
    console.error('[adminController] updateShowtime:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ════════════════════════════════════════════════════════════
//  USER MANAGEMENT
// ════════════════════════════════════════════════════════════

exports.getAllUsers = async (req, res) => {
  try {
    const data = await AdminModel.getAllUsers();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[adminController] getAllUsers:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.changeUserRole = async (req, res) => {
  try {
    await AdminModel.changeUserRole(parseInt(req.params.id), req.body.roleName);
    res.json({ success: true, message: `Đã đổi vai trò người dùng sang ${req.body.roleName}.` });
  } catch (err) {
    console.error('[adminController] changeUserRole:', err.message);
    if (err.message.includes('không hợp lệ')) return res.status(400).json({ success: false, message: err.message });
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    await AdminModel.toggleUserStatus(parseInt(req.params.id));
    res.json({ success: true, message: 'Đã thay đổi trạng thái tài khoản.' });
  } catch (err) {
    console.error('[adminController] toggleUserStatus:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ════════════════════════════════════════════════════════════
//  VOUCHER MANAGEMENT
// ════════════════════════════════════════════════════════════

exports.getAllVouchers = async (req, res) => {
  try {
    const data = await AdminModel.getAllVouchers();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[adminController] getAllVouchers:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.createVoucher = async (req, res) => {
  try {
    const { code, discountType, discountValue, startDate, endDate } = req.body;
    if (!code || !discountType || discountValue == null || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc.' });
    }

    const voucher = await AdminModel.createVoucher(req.body);
    res.status(201).json({ success: true, message: 'Tạo voucher thành công!', data: voucher });
  } catch (err) {
    console.error('[adminController] createVoucher:', err.message);
    if (err.message.includes('Mã voucher đã tồn tại') || (err.number === 2627)) {
      return res.status(409).json({ success: false, message: 'Mã voucher đã tồn tại.' });
    }
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ════════════════════════════════════════════════════════════
//  STATISTICS / REVENUE REPORTS
// ════════════════════════════════════════════════════════════

exports.getRevenueStats = async (req, res) => {
  try {
    const result = await AdminModel.getRevenueStats(req.query);
    res.json({ success: true, summary: result.summary, data: result.data });
  } catch (err) {
    console.error('[adminController] getRevenueStats:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const data = await AdminModel.getDashboardStats();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[adminController] getDashboardStats:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getTopMovies = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const data = await AdminModel.getTopMovies(limit);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[adminController] getTopMovies:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ============================================================
//  controllers/adminController.js  –  Admin / Manager APIs (MVC Refactored)
//  Dành cho: Quản lý (Role: Admin, Manager)
// ============================================================
const AdminModel = require('../models/adminModel');
const PDFDocument = require('pdfkit');

function removeAccents(str) {
  if(!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

// ════════════════════════════════════════════════════════════
//  MOVIE MANAGEMENT
// ════════════════════════════════════════════════════════════

exports.createMovie = async (req, res) => {
  try {
    console.log('[adminController] Content-Type:', req.headers['content-type']);
    console.log('[adminController] req.body:', req.body);
    console.log('[adminController] req.file:', req.file);

    const { title, description, director, duration, ageRating, status, mainCast } = req.body || {};
    if (!title || !duration) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: title, duration.' });
    }

    const posterURL = req.file ? 'images/' + req.file.filename : 'images/default_poster.png';

    const movieData = {
      title,
      description,
      director,
      duration: parseInt(duration),
      ageRating,
      posterURL,
      status,
      mainCast
    };

    const movie = await AdminModel.createMovie(movieData);
    res.status(201).json({ success: true, message: 'Thêm phim thành công!', data: movie });
  } catch (err) {
    console.error('[adminController] createMovie:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm phim.' });
  }
};

exports.getRooms = async (req, res) => {
  try {
    const data = await AdminModel.getRooms();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[adminController] getRooms:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getSeatsByRoom = async (req, res) => {
  try {
    const data = await AdminModel.getSeatsByRoom(parseInt(req.params.id));
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[adminController] getSeatsByRoom:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.saveSeats = async (req, res) => {
  try {
    const roomId = parseInt(req.params.id);
    const { seats } = req.body;
    if (!seats || !Array.isArray(seats)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu ghế không hợp lệ.' });
    }
    
    await AdminModel.saveSeats(roomId, seats);
    res.json({ success: true, message: 'Lưu sơ đồ ghế thành công!' });
  } catch (err) {
    console.error('[adminController] saveSeats:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server khi lưu sơ đồ ghế.' });
  }
};

exports.updateMovie = async (req, res) => {
  try {
    const posterURL = req.file ? 'images/' + req.file.filename : undefined;
    const body = { ...req.body };
    if (posterURL) body.posterURL = posterURL;
    if (body.duration) body.duration = parseInt(body.duration);

    const movie = await AdminModel.updateMovie(parseInt(req.params.id), body);
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
    if (!movieId || !roomId || !startTime || !endTime || price == null || isNaN(price)) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin: movieId, roomId, startTime, endTime, price.' });
    }

    const showtime = await AdminModel.createShowtime(req.body);
    res.status(201).json({ success: true, message: 'Tạo suất chiếu thành công!', data: showtime });
  } catch (err) {
    console.error('[adminController] createShowtime error:', err);
    try {
      const logMsg = `${new Date().toISOString()} - ERROR: ${err.message}\nStack: ${err.stack}\nBody: ${JSON.stringify(req.body)}\n\n`;
      require('fs').appendFileSync(require('path').join(__dirname, '../error.log'), logMsg);
    } catch (logErr) {
      console.error('Failed to write to error.log:', logErr);
    }
    if (err.message.includes('đã có lịch')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
};

exports.updateShowtime = async (req, res) => {
  try {
    const showtime = await AdminModel.updateShowtime(parseInt(req.params.id), req.body);
    if (!showtime) return res.status(404).json({ success: false, message: 'Không tìm thấy suất chiếu.' });

    res.json({ success: true, message: 'Cập nhật suất chiếu thành công!', data: showtime });
  } catch (err) {
    console.error('[adminController] updateShowtime:', err.message);
    if (err.message.includes('đã có lịch')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.deleteShowtime = async (req, res) => {
  try {
    const showtime = await AdminModel.deleteShowtime(parseInt(req.params.id));
    if (!showtime) return res.status(404).json({ success: false, message: 'Không tìm thấy suất chiếu.' });
    res.json({ success: true, message: 'Đã hủy suất chiếu.', data: showtime });
  } catch (err) {
    console.error('[adminController] deleteShowtime:', err.message);
    if (err.message.includes('đã có vé')) {
      return res.status(409).json({ success: false, message: err.message });
    }
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
//  F&B MANAGEMENT
// ════════════════════════════════════════════════════════════

exports.getAllFnB = async (req, res) => {
  try {
    const data = await AdminModel.getAllFnB();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[adminController] getAllFnB:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.createFnB = async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc.' });
    }

    const fnb = await AdminModel.createFnB(req.body);
    res.status(201).json({ success: true, message: 'Tạo mặt hàng thành công!', data: fnb });
  } catch (err) {
    console.error('[adminController] createFnB:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.updateFnB = async (req, res) => {
  try {
    const fnb = await AdminModel.updateFnB(parseInt(req.params.id), req.body);
    if (!fnb) return res.status(404).json({ success: false, message: 'Không tìm thấy mặt hàng.' });
    res.json({ success: true, message: 'Cập nhật mặt hàng thành công!', data: fnb });
  } catch (err) {
    console.error('[adminController] updateFnB:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.deleteFnB = async (req, res) => {
  try {
    await AdminModel.deleteFnB(parseInt(req.params.id));
    res.json({ success: true, message: 'Xóa mặt hàng thành công!' });
  } catch (err) {
    console.error('[adminController] deleteFnB:', err.message);
    if (err.message.includes('người mua')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.toggleFnBAvailability = async (req, res) => {
  try {
    const fnb = await AdminModel.toggleFnBAvailability(parseInt(req.params.id));
    if (!fnb) return res.status(404).json({ success: false, message: 'Không tìm thấy mặt hàng.' });
    res.json({ success: true, message: 'Đã thay đổi trạng thái khả dụng.', data: fnb });
  } catch (err) {
    console.error('[adminController] toggleFnBAvailability:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getFnBStats = async (req, res) => {
  try {
    const stats = await AdminModel.getFnBStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('[adminController] getFnBStats:', err.message);
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
    const data = await AdminModel.getDashboardStats(req.query);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[adminController] getDashboardStats:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getCinemas = async (req, res) => {
  try {
    const data = await AdminModel.getCinemas();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[adminController] getCinemas:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getRecentTransactions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const data = await AdminModel.getRecentTransactions(limit);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[adminController] getRecentTransactions:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getMonthlyRevenue = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const cinemaId = req.query.cinemaId || null;
    const data = await AdminModel.getMonthlyRevenue(year, cinemaId);
    res.json({ success: true, year, data });
  } catch (err) {
    console.error('[adminController] getMonthlyRevenue:', err.message);
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

exports.getLiveRooms = async (req, res) => {
  try {
    const cinemaId = req.query.cinemaId || null;
    const data = await AdminModel.getLiveRoomsStatus(cinemaId);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[adminController] getLiveRooms:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.exportPdf = async (req, res) => {
  try {
    const period = req.query.period || 'all';
    const cinemaId = req.query.cinemaId || null;

    // Fetch stats
    const stats = await AdminModel.getDashboardStats({ cinemaId, period });

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=D-Cinema-Report.pdf');
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('D-CINEMA DASHBOARD REPORT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('Generated at: ' + new Date().toLocaleString('vi-VN'));
    doc.moveDown(2);

    // KPI Section
    doc.fontSize(16).text('1. OVERVIEW STATISTICS', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Total Revenue: ${new Intl.NumberFormat('vi-VN').format(stats.TotalRevenue || 0)} VND`);
    doc.text(`Tickets Sold: ${new Intl.NumberFormat('vi-VN').format(stats.TicketSales || 0)}`);
    doc.text(`F&B Revenue: ${new Intl.NumberFormat('vi-VN').format(stats.FnBSales || 0)} VND`);
    doc.text(`Occupancy Rate: ${stats.OccupancyRate || 0}%`);
    doc.moveDown(2);

    // Top Movies Section
    const topMovies = await AdminModel.getTopMovies(5);
    doc.fontSize(16).text('2. TOP MOVIES TODAY', { underline: true });
    doc.moveDown();
    if (topMovies && topMovies.length > 0) {
      topMovies.forEach((m, idx) => {
        doc.text(`${idx + 1}. ${removeAccents(m.Title)}`);
        doc.text(`   Revenue: ${new Intl.NumberFormat('vi-VN').format(m.TodayRevenue)} VND | Tickets: ${m.TotalTickets}`);
        doc.moveDown(0.5);
      });
    } else {
      doc.text('No movie data available.');
    }

    doc.end();

  } catch (err) {
    console.error('[adminController] exportPdf:', err.message);
    res.status(500).json({ success: false, message: 'Server error generating PDF.' });
  }
};

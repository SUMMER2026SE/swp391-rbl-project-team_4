// ============================================================
//  controllers/adminController.js  –  Admin / Manager APIs (MVC Refactored)
//  Dành cho: Quản lý (Role: Admin, Manager)
// ============================================================
const AdminModel = require('../models/adminModel');
const PDFDocument = require('pdfkit');

function formatReportDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? formatReportDate(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows) {
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

function htmlCell(value) {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? formatReportDate(value) : String(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlTable(title, rows) {
  const body = rows.map((row, rowIndex) => {
    const tag = rowIndex === 0 ? 'th' : 'td';
    return `<tr>${row.map(cell => `<${tag}>${htmlCell(cell)}</${tag}>`).join('')}</tr>`;
  }).join('');
  return `<h2>${htmlCell(title)}</h2><table>${body}</table>`;
}

async function buildReportData(query = {}) {
  const period = query.period || 'all';
  const cinemaId = query.cinemaId || null;
  const year = parseInt(query.year) || new Date().getFullYear();

  const [stats, topMovies, recentTxns, monthlyRevenue, revenueStats] = await Promise.all([
    AdminModel.getDashboardStats({ cinemaId, period }),
    AdminModel.getTopMovies(20),
    AdminModel.getRecentTransactions(50),
    AdminModel.getMonthlyRevenue(year, cinemaId),
    AdminModel.getRevenueStats({ cinemaId }),
  ]);

  return { period, cinemaId, year, stats, topMovies, recentTxns, monthlyRevenue, revenueStats };
}

function buildReportRows(report) {
  const overviewRows = [
    ['Metric', 'Value'],
    ['Period', report.period],
    ['Year', report.year],
    ['Total Revenue', report.stats.TotalRevenue || 0],
    ['Tickets Sold', report.stats.TicketSales || 0],
    ['FnB Revenue', report.stats.FnBSales || 0],
    ['Occupancy Rate (%)', report.stats.OccupancyRate || 0],
  ];

  const topMovieRows = [
    ['Rank', 'Movie', 'Tickets', 'Today Revenue'],
    ...(report.topMovies || []).map((movie, index) => [
      index + 1,
      movie.Title,
      movie.TotalTickets || 0,
      movie.TodayRevenue || 0,
    ]),
  ];

  const transactionRows = [
    ['Transaction ID', 'Branch', 'Item', 'Date', 'Amount', 'Status'],
    ...(report.recentTxns || []).map(txn => [
      txn.id,
      txn.branch,
      txn.item,
      txn.date,
      txn.amount,
      txn.status,
    ]),
  ];

  const monthlyRows = [
    ['Month', 'Ticket Revenue', 'FnB Revenue', 'Total Revenue'],
    ...(report.monthlyRevenue || []).map(item => {
      const ticketRevenue = Number(item.TicketRevenue || 0);
      const fnbRevenue = Number(item.FnBRevenue || 0);
      return [item.MonthNumber, ticketRevenue, fnbRevenue, ticketRevenue + fnbRevenue];
    }),
  ];

  const detailRows = [
    ['Booking Date', 'Movie', 'Cinema', 'Tickets', 'Total Revenue', 'Average Ticket Revenue'],
    ...((report.revenueStats && report.revenueStats.data) || []).map(item => [
      formatReportDate(item.BookingDate).slice(0, 10),
      item.MovieTitle,
      item.CinemaName,
      item.TotalTickets || 0,
      item.TotalRevenue || 0,
      item.AvgTicketRevenue || 0,
    ]),
  ];

  return { overviewRows, topMovieRows, transactionRows, monthlyRows, detailRows };
}

function buildCsvReport(report) {
  const rows = buildReportRows(report);
  return [
    'D-CINEMA DASHBOARD REPORT',
    `Generated At,${csvCell(new Date())}`,
    '',
    'OVERVIEW',
    rowsToCsv(rows.overviewRows),
    '',
    'TOP MOVIES',
    rowsToCsv(rows.topMovieRows),
    '',
    'RECENT TRANSACTIONS',
    rowsToCsv(rows.transactionRows),
    '',
    'MONTHLY REVENUE',
    rowsToCsv(rows.monthlyRows),
    '',
    'REVENUE DETAILS',
    rowsToCsv(rows.detailRows),
  ].join('\r\n');
}

function buildExcelReport(report) {
  const rows = buildReportRows(report);
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #111827; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 15px; margin: 24px 0 8px; color: #991b1b; }
    .meta { color: #6b7280; margin-bottom: 16px; }
    table { border-collapse: collapse; margin-bottom: 10px; }
    th { background: #111827; color: #ffffff; font-weight: 700; }
    th, td { border: 1px solid #d1d5db; padding: 6px 10px; mso-number-format: "\\@"; }
  </style>
</head>
<body>
  <h1>D-CINEMA DASHBOARD REPORT</h1>
  <div class="meta">Generated at: ${htmlCell(formatReportDate(new Date()))}</div>
  ${htmlTable('Overview', rows.overviewRows)}
  ${htmlTable('Top Movies', rows.topMovieRows)}
  ${htmlTable('Recent Transactions', rows.transactionRows)}
  ${htmlTable('Monthly Revenue', rows.monthlyRows)}
  ${htmlTable('Revenue Details', rows.detailRows)}
</body>
</html>`;
}

function removeAccents(str) {
  if (!str) return '';
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

    const { title, description, director, duration, ageRating, status, mainCast, trailerURL } = req.body || {};
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
      mainCast,
      trailerURL
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
    console.log('[adminController] updateMovie req.body:', req.body);
    console.log('[adminController] updateMovie trailerURL:', req.body.trailerURL);
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

exports.updateVoucher = async (req, res) => {
  try {
    const { code, discountType, discountValue, startDate, endDate } = req.body;
    if (!code || !discountType || discountValue == null || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc.' });
    }

    const voucher = await AdminModel.updateVoucher(parseInt(req.params.id), req.body);
    if (!voucher) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });
    res.json({ success: true, message: 'Cập nhật voucher thành công!', data: voucher });
  } catch (err) {
    console.error('[adminController] updateVoucher:', err.message);
    if (err.message.includes('Mã voucher đã tồn tại') || (err.number === 2627)) {
      return res.status(409).json({ success: false, message: 'Mã voucher đã tồn tại.' });
    }
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.deleteVoucher = async (req, res) => {
  try {
    await AdminModel.deleteVoucher(parseInt(req.params.id));
    res.json({ success: true, message: 'Xóa voucher thành công!' });
  } catch (err) {
    console.error('[adminController] deleteVoucher:', err.message);
    if (err.message.includes('đã có người sử dụng')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.toggleVoucherActive = async (req, res) => {
  try {
    const voucher = await AdminModel.toggleVoucherActive(parseInt(req.params.id));
    if (!voucher) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });
    res.json({ success: true, message: 'Đã thay đổi trạng thái khả dụng.', data: voucher });
  } catch (err) {
    console.error('[adminController] toggleVoucherActive:', err.message);
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

exports.createCinema = async (req, res) => {
  try {
    const { name, address, city } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Tên rạp là bắt buộc.' });
    const cinema = await AdminModel.createCinema({ name, address, city });
    res.status(201).json({ success: true, message: 'Thêm rạp thành công!', data: cinema });
  } catch (err) {
    console.error('[adminController] createCinema:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.updateCinema = async (req, res) => {
  try {
    const { name, address, city } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Tên rạp là bắt buộc.' });
    const cinema = await AdminModel.updateCinema(parseInt(req.params.id), { name, address, city });
    if (!cinema) return res.status(404).json({ success: false, message: 'Không tìm thấy rạp.' });
    res.json({ success: true, message: 'Cập nhật rạp thành công!', data: cinema });
  } catch (err) {
    console.error('[adminController] updateCinema:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.deleteCinema = async (req, res) => {
  try {
    await AdminModel.deleteCinema(parseInt(req.params.id));
    res.json({ success: true, message: 'Xóa rạp thành công!' });
  } catch (err) {
    console.error('[adminController] deleteCinema:', err.message);
    const status = err.message.includes('Không thể xóa') ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const { cinemaId, name } = req.body;
    if (!cinemaId || !name) return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin.' });
    const room = await AdminModel.createRoom({ cinemaId: parseInt(cinemaId), name, totalSeats: 0 });
    res.status(201).json({ success: true, message: 'Thêm phòng thành công!', data: room });
  } catch (err) {
    console.error('[adminController] createRoom:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Tên phòng là bắt buộc.' });
    const room = await AdminModel.updateRoom(parseInt(req.params.id), { name });
    if (!room) return res.status(404).json({ success: false, message: 'Không tìm thấy phòng.' });
    res.json({ success: true, message: 'Cập nhật phòng thành công!', data: room });
  } catch (err) {
    console.error('[adminController] updateRoom:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    await AdminModel.deleteRoom(parseInt(req.params.id));
    res.json({ success: true, message: 'Xóa phòng thành công!' });
  } catch (err) {
    console.error('[adminController] deleteRoom:', err.message);
    const status = err.message.includes('Không thể xóa') ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
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
    const topMovies = await AdminModel.getTopMovies(5);
    const recentTxns = await AdminModel.getRecentTransactions(5);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=D-Cinema-Report.pdf');
    doc.pipe(res);

    // Remove accents function if not globally available, just copy logic or use simple replace
    const normalizeStr = str => {
      if (!str) return '';
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
    };

    // Header
    doc.fillColor('#1f2937').fontSize(22).text('D-CINEMA DASHBOARD REPORT', { align: 'center', underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#6b7280').fontSize(10).text(`Generated at: ${new Date().toLocaleString('en-US')}`, { align: 'center' });
    doc.text(`Period: ${period.toUpperCase()}`, { align: 'center' });
    doc.moveDown(2);

    // 1. KPI Section (4 boxes)
    doc.fillColor('#111827').fontSize(14).text('1. OVERVIEW STATISTICS');
    doc.moveDown(0.5);

    // Draw KPI table
    const startY = doc.y;
    doc.rect(50, startY, 500, 60).stroke('#d1d5db');
    doc.moveTo(175, startY).lineTo(175, startY + 60).stroke('#d1d5db');
    doc.moveTo(300, startY).lineTo(300, startY + 60).stroke('#d1d5db');
    doc.moveTo(425, startY).lineTo(425, startY + 60).stroke('#d1d5db');

    doc.fontSize(10).fillColor('#6b7280');
    doc.text('Total Revenue', 60, startY + 10, { width: 105, align: 'center' });
    doc.text('Tickets Sold', 185, startY + 10, { width: 105, align: 'center' });
    doc.text('F&B Revenue', 310, startY + 10, { width: 105, align: 'center' });
    doc.text('Occupancy', 435, startY + 10, { width: 105, align: 'center' });

    doc.fontSize(12).fillColor('#111827');
    doc.text(`${new Intl.NumberFormat('en-US').format(stats.TotalRevenue || 0)} VND`, 60, startY + 30, { width: 105, align: 'center' });
    doc.text(`${new Intl.NumberFormat('en-US').format(stats.TicketSales || 0)}`, 185, startY + 30, { width: 105, align: 'center' });
    doc.text(`${new Intl.NumberFormat('en-US').format(stats.FnBSales || 0)} VND`, 310, startY + 30, { width: 105, align: 'center' });
    doc.text(`${stats.OccupancyRate || 0}%`, 435, startY + 30, { width: 105, align: 'center' });

    doc.y = startY + 80;

    // 2. Top Movies Section
    doc.fontSize(14).fillColor('#111827').text('2. TOP MOVIES RANKING');
    doc.moveDown(0.5);

    // Table Header
    let tableY = doc.y;
    doc.rect(50, tableY, 500, 20).fillAndStroke('#f3f4f6', '#d1d5db');
    doc.fillColor('#4b5563').fontSize(10);
    doc.text('#', 60, tableY + 5);
    doc.text('Movie Title', 90, tableY + 5);
    doc.text('Tickets', 350, tableY + 5);
    doc.text('Revenue (VND)', 430, tableY + 5);

    tableY += 20;
    doc.fillColor('#111827');

    if (topMovies && topMovies.length > 0) {
      topMovies.forEach((m, idx) => {
        doc.rect(50, tableY, 500, 25).stroke('#e5e7eb');
        doc.text(`${idx + 1}`, 60, tableY + 7);
        doc.text(normalizeStr(m.Title).substring(0, 45), 90, tableY + 7);
        doc.text(`${new Intl.NumberFormat('en-US').format(m.TotalTickets)}`, 350, tableY + 7);
        doc.text(`${new Intl.NumberFormat('en-US').format(m.TodayRevenue)}`, 430, tableY + 7);
        tableY += 25;
      });
    } else {
      doc.rect(50, tableY, 500, 25).stroke('#e5e7eb');
      doc.text('No movie data available.', 60, tableY + 7);
      tableY += 25;
    }

    doc.y = tableY + 30;

    // 3. Recent Transactions
    doc.fontSize(14).fillColor('#111827').text('3. RECENT TRANSACTIONS');
    doc.moveDown(0.5);

    tableY = doc.y;
    doc.rect(50, tableY, 500, 20).fillAndStroke('#f3f4f6', '#d1d5db');
    doc.fillColor('#4b5563').fontSize(10);
    doc.text('Txn ID', 60, tableY + 5);
    doc.text('Branch', 120, tableY + 5);
    doc.text('Date', 250, tableY + 5);
    doc.text('Amount', 370, tableY + 5);
    doc.text('Status', 470, tableY + 5);

    tableY += 20;
    doc.fillColor('#111827');

    if (recentTxns && recentTxns.length > 0) {
      recentTxns.forEach(t => {
        doc.rect(50, tableY, 500, 25).stroke('#e5e7eb');
        doc.text(normalizeStr(t.id), 60, tableY + 7);
        doc.text(normalizeStr(t.branch).substring(0, 20), 120, tableY + 7);
        doc.text(normalizeStr(t.date), 250, tableY + 7);
        doc.text(normalizeStr(t.amount), 370, tableY + 7);

        // Status color
        if (t.status === 'COMPLETED') doc.fillColor('#10b981');
        else if (t.status === 'CANCELLED') doc.fillColor('#ef4444');
        else doc.fillColor('#f59e0b');

        doc.text(t.status, 470, tableY + 7);
        doc.fillColor('#111827'); // reset
        tableY += 25;
      });
    } else {
      doc.rect(50, tableY, 500, 25).stroke('#e5e7eb');
      doc.text('No recent transactions.', 60, tableY + 7);
      tableY += 25;
    }

    // Footer
    doc.y = 750;
    doc.fontSize(8).fillColor('#9ca3af').text('This document is automatically generated by D-Cinema System.', { align: 'center' });

    doc.end();

  } catch (err) {
    console.error('[adminController] exportPdf:', err.message);
    res.status(500).json({ success: false, message: 'Server error generating PDF.' });
  }
};

exports.exportCsv = async (req, res) => {
  try {
    const report = await buildReportData(req.query);
    const csv = buildCsvReport(report);
    const filename = `D-Cinema-Report-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from('\ufeff' + csv, 'utf8'));
  } catch (err) {
    console.error('[adminController] exportCsv:', err.message);
    res.status(500).json({ success: false, message: 'Server error generating CSV report.' });
  }
};

exports.exportExcel = async (req, res) => {
  try {
    const report = await buildReportData(req.query);
    const workbookHtml = buildExcelReport(report);
    const filename = `D-Cinema-Report-${new Date().toISOString().slice(0, 10)}.xls`;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from('\ufeff' + workbookHtml, 'utf8'));
  } catch (err) {
    console.error('[adminController] exportExcel:', err.message);
    res.status(500).json({ success: false, message: 'Server error generating Excel report.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/admin/stats/revenue-chart
// ─────────────────────────────────────────────────────────────
exports.getRevenueChartData = async (req, res) => {
  try {
    const period = req.query.period || 'all'; // today, week, month, all
    const cinemaId = req.query.cinemaId || null;

    const data = await AdminModel.getRevenueChartData({ period, cinemaId });

    let labels = [];
    let ticketData = [];
    let fnbData = [];

    if (period === 'today') {
      labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
      ticketData = new Array(24).fill(0);
      fnbData = new Array(24).fill(0);

      data.forEach(t => {
        const hr = new Date(t.BookedAt).getHours();
        ticketData[hr] += t.TotalAmount || 0;
        fnbData[hr] += t.FnBRevenue || 0;
      });

    } else if (period === 'week') {
      labels = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      ticketData = new Array(7).fill(0);
      fnbData = new Array(7).fill(0);

      data.forEach(t => {
        const day = new Date(t.BookedAt).getDay(); // 0 is Sunday
        ticketData[day] += t.TotalAmount || 0;
        fnbData[day] += t.FnBRevenue || 0;
      });

      // Shift so Monday is first
      labels.push(labels.shift());
      ticketData.push(ticketData.shift());
      fnbData.push(fnbData.shift());

    } else if (period === 'month') {
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      labels = Array.from({ length: daysInMonth }, (_, i) => `Ngày ${i + 1}`);
      ticketData = new Array(daysInMonth).fill(0);
      fnbData = new Array(daysInMonth).fill(0);

      data.forEach(t => {
        const d = new Date(t.BookedAt).getDate() - 1;
        ticketData[d] += t.TotalAmount || 0;
        fnbData[d] += t.FnBRevenue || 0;
      });

    } else {
      // all -> 12 months
      labels = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
      ticketData = new Array(12).fill(0);
      fnbData = new Array(12).fill(0);

      data.forEach(t => {
        const m = new Date(t.BookedAt).getMonth();
        ticketData[m] += t.TotalAmount || 0;
        fnbData[m] += t.FnBRevenue || 0;
      });
    }

    res.json({
      success: true,
      data: {
        labels,
        ticketData,
        fnbData
      }
    });

  } catch (err) {
    console.error('[adminController] getRevenueChartData:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ════════════════════════════════════════════════════════════
//  PROMOTIONS MANAGEMENT
// ════════════════════════════════════════════════════════════

exports.getAllPromotions = async (req, res) => {
  try {
    const data = await AdminModel.getAllPromotions();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[adminController] getAllPromotions:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getActivePromotions = async (req, res) => {
  try {
    const data = await AdminModel.getActivePromotions();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[adminController] getActivePromotions:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.createPromotion = async (req, res) => {
  try {
    const { title, description, badgeLabel, linkURL, isFeatured, isActive, sortOrder } = req.body || {};
    if (!title) {
      return res.status(400).json({ success: false, message: 'Thiếu tiêu đề (title).' });
    }
    const imageURL = req.file ? 'images/' + req.file.filename : (req.body.imageURL || null);
    const promo = await AdminModel.createPromotion({
      title, description, badgeLabel, imageURL, linkURL,
      isFeatured: isFeatured === 'true' || isFeatured === true || isFeatured === 1,
      isActive: isActive !== 'false' && isActive !== false && isActive !== 0,
      sortOrder
    });
    res.status(201).json({ success: true, message: 'Thêm khuyến mãi thành công!', data: promo });
  } catch (err) {
    console.error('[adminController] createPromotion:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.updatePromotion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, badgeLabel, linkURL, isFeatured, isActive, sortOrder } = req.body || {};
    const imageURL = req.file ? 'images/' + req.file.filename : (req.body.imageURL || null);
    const promo = await AdminModel.updatePromotion(id, {
      title, description, badgeLabel, imageURL, linkURL,
      isFeatured: isFeatured === 'true' || isFeatured === true || isFeatured === 1,
      isActive: isActive !== 'false' && isActive !== false && isActive !== 0,
      sortOrder
    });
    if (!promo) return res.status(404).json({ success: false, message: 'Không tìm thấy khuyến mãi.' });
    res.json({ success: true, message: 'Cập nhật khuyến mãi thành công!', data: promo });
  } catch (err) {
    console.error('[adminController] updatePromotion:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.deletePromotion = async (req, res) => {
  try {
    await AdminModel.deletePromotion(parseInt(req.params.id));
    res.json({ success: true, message: 'Xóa khuyến mãi thành công!' });
  } catch (err) {
    console.error('[adminController] deletePromotion:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.togglePromotionActive = async (req, res) => {
  try {
    const promo = await AdminModel.togglePromotionActive(parseInt(req.params.id));
    if (!promo) return res.status(404).json({ success: false, message: 'Không tìm thấy khuyến mãi.' });
    res.json({ success: true, message: 'Đã thay đổi trạng thái khuyến mãi.', data: promo });
  } catch (err) {
    console.error('[adminController] togglePromotionActive:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};


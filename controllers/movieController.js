// ============================================================
//  controllers/movieController.js  –  Movie & Showtime APIs (MVC Refactored)
//  Dành cho: Khách vãng lai (không cần đăng nhập)
// ============================================================
const MovieModel = require('../models/movieModel');

// ─────────────────────────────────────────────────────────────
//  GET /api/movies/now-showing
//  Lấy danh sách phim đang chiếu
// ─────────────────────────────────────────────────────────────
exports.getNowShowing = async (req, res) => {
  try {
    const { city } = req.query;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const data = await MovieModel.getNowShowing(city);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[movieController] getNowShowing:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/movies/coming-soon
//  Lấy danh sách phim sắp chiếu
// ─────────────────────────────────────────────────────────────
exports.getComingSoon = async (req, res) => {
  try {
    const data = await MovieModel.getComingSoon();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[movieController] getComingSoon:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/movies
//  Lấy tất cả phim (có thể filter bằng query ?status=now-showing&genre=Action)
// ─────────────────────────────────────────────────────────────
exports.getAllMovies = async (req, res) => {
  try {
    const { status, genre, search } = req.query;
    const data = await MovieModel.getAllMovies({ status, genre, search });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[movieController] getAllMovies:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/movies/:id
//  Chi tiết một bộ phim
// ─────────────────────────────────────────────────────────────
exports.getMovieById = async (req, res) => {
  try {
    const movie = await MovieModel.getMovieById(req.params.id);
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phim.' });
    }
    res.json({ success: true, data: movie });
  } catch (err) {
    console.error('[movieController] getMovieById:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/movies/:id/showtimes
//  Lịch chiếu của một bộ phim (filter theo ngày: ?date=2024-12-25)
// ─────────────────────────────────────────────────────────────
exports.getMovieReviews = async (req, res) => {
  try {
    const data = await MovieModel.getMovieReviews(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[movieController] getMovieReviews:', err.message);
    res.status(500).json({ success: false, message: 'Loi server.' });
  }
};

exports.getMyMovieReview = async (req, res) => {
  try {
    const data = await MovieModel.getMyMovieReview(req.params.id, req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[movieController] getMyMovieReview:', err.message);
    res.status(500).json({ success: false, message: 'Loi server.' });
  }
};

exports.saveMovieReview = async (req, res) => {
  try {
    const review = await MovieModel.saveMovieReview(req.params.id, req.user.userId, req.body || {});
    res.json({ success: true, message: 'Da luu danh gia.', data: review });
  } catch (err) {
    console.error('[movieController] saveMovieReview:', err.message);
    if (err.code === 'INVALID_RATING' || err.code === 'COMMENT_TOO_LONG' || err.code === 'INVALID_MOVIE') {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err.message && err.message.includes('MOVIE_NOT_FOUND')) {
      return res.status(404).json({ success: false, message: 'Khong tim thay phim.' });
    }
    if (err.message && err.message.includes('TICKET_REQUIRED')) {
      return res.status(403).json({ success: false, message: 'Ban can co ve da thanh toan cua phim nay moi duoc danh gia.' });
    }
    res.status(500).json({ success: false, message: 'Loi server.' });
  }
};

exports.getShowtimesByMovie = async (req, res) => {
  try {
    const { date } = req.query;
    const data = await MovieModel.getShowtimesByMovie(req.params.id, date);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[movieController] getShowtimesByMovie:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/movies/showtimes/:showtimeId/seats
//  Trạng thái ghế ngồi của một suất chiếu
// ─────────────────────────────────────────────────────────────
const socketManager = require('../sockets/socketManager');

exports.getSeatsByShowtime = async (req, res) => {
  try {
    const data = await MovieModel.getSeatsByShowtime(req.params.showtimeId);
    const sessionId = req.query.sessionId;
    
    const BookingModel = require('../models/bookingModel');
    const lockedSeatsDB = await BookingModel.getLockedSeatsDB(req.params.showtimeId);
    
    const lockMap = new Map();
    lockedSeatsDB.forEach(s => {
      lockMap.set(Number(s.SeatID), s);
    });
    
    data.forEach(seat => {
      const lock = lockMap.get(Number(seat.SeatID));
      if (!lock) return;

      seat.LockSessionID = lock.SessionID;
      seat.LockExpiresAt = lock.ExpiresAt;
      seat.LockRemainingSeconds = Math.max(0, Number(lock.RemainingSeconds || 0));

      if (seat.SeatStatus === 'available' && lock.SessionID !== sessionId) {
        seat.SeatStatus = 'locked';
      }
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error('[movieController] getSeatsByShowtime:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getCinemas = async (req, res) => {
  try {
    const data = await MovieModel.getCinemas();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[movieController] getCinemas:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getShowtimeDetails = async (req, res) => {
  try {
    const data = await MovieModel.getShowtimeDetails(req.params.showtimeId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy suất chiếu.' });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('[movieController] getShowtimeDetails:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getShowtimes = async (req, res) => {
  try {
    const { cinemaId, date, movieId } = req.query;
    if (!cinemaId || !date) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp cinemaId và date.' });
    }
    const data = await MovieModel.getShowtimes({ cinemaId, date, movieId });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[movieController] getShowtimes:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/movies/promotions
//  Lấy danh sách khuyến mãi đang hoạt động (public, không cần auth)
// ─────────────────────────────────────────────────────────────
const AdminModel = require('../models/adminModel');

exports.getPublicPromotions = async (req, res) => {
  try {
    const data = await AdminModel.getActivePromotions();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[movieController] getPublicPromotions:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};


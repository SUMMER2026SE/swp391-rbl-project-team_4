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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const data = await MovieModel.getNowShowing();
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
exports.getSeatsByShowtime = async (req, res) => {
  try {
    const data = await MovieModel.getSeatsByShowtime(req.params.showtimeId);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[movieController] getSeatsByShowtime:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

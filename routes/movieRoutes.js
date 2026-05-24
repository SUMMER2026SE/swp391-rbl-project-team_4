// ============================================================
//  routes/movieRoutes.js  –  Movie & Showtime Routes
// ============================================================
const express     = require('express');
const router      = express.Router();
const movieCtrl   = require('../controllers/movieController');

// --- Public Routes (không cần đăng nhập) ---

// GET /api/movies                            — Tất cả phim (hỗ trợ filter)
router.get('/',                              movieCtrl.getAllMovies);

// GET /api/movies/now-showing                — Phim đang chiếu
router.get('/now-showing',                   movieCtrl.getNowShowing);

// GET /api/movies/coming-soon               — Phim sắp chiếu
router.get('/coming-soon',                   movieCtrl.getComingSoon);

// GET /api/movies/showtimes/:showtimeId/seats — Ghế của suất chiếu
router.get('/showtimes/:showtimeId/seats',   movieCtrl.getSeatsByShowtime);

// GET /api/movies/:id                        — Chi tiết phim
router.get('/:id',                           movieCtrl.getMovieById);

// GET /api/movies/:id/showtimes             — Lịch chiếu của phim (?date=YYYY-MM-DD)
router.get('/:id/showtimes',                 movieCtrl.getShowtimesByMovie);

module.exports = router;

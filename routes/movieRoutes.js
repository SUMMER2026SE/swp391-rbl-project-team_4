// ============================================================
//  routes/movieRoutes.js  –  Movie & Showtime Routes
// ============================================================
const express     = require('express');
const router      = express.Router();
const movieCtrl   = require('../controllers/movieController');
const { verifyToken } = require('../middleware/authMiddleware');

// --- Public Routes (không cần đăng nhập) ---

// GET /api/movies                            — Tất cả phim (hỗ trợ filter)
router.get('/',                              movieCtrl.getAllMovies);

// GET /api/movies/now-showing                — Phim đang chiếu
router.get('/now-showing',                   movieCtrl.getNowShowing);

// GET /api/movies/coming-soon               — Phim sắp chiếu
router.get('/coming-soon',                   movieCtrl.getComingSoon);

// GET /api/movies/showtimes/:showtimeId/seats — Ghế của suất chiếu
router.get('/showtimes/:showtimeId/seats',   movieCtrl.getSeatsByShowtime);

// GET /api/movies/cinemas                    — Danh sách rạp
router.get('/cinemas',                       movieCtrl.getCinemas);

// GET /api/movies/showtimes                  — Lịch chiếu theo rạp và ngày
router.get('/showtimes',                     movieCtrl.getShowtimes);

// GET /api/movies/showtimes/:showtimeId      — Chi tiết một suất chiếu
router.get('/showtimes/:showtimeId',         movieCtrl.getShowtimeDetails);

// GET /api/movies/promotions                 — Khuyến mãi đang hoạt động (public)
router.get('/promotions',                    movieCtrl.getPublicPromotions);

// GET /api/movies/:id                        — Chi tiết phim
router.get('/:id',                           movieCtrl.getMovieById);


// GET /api/movies/:id/showtimes             — Lịch chiếu của phim (?date=YYYY-MM-DD)
router.get('/:id/showtimes',                 movieCtrl.getShowtimesByMovie);

// GET /api/movies/:id/reviews                - Danh sach danh gia phim
router.get('/:id/reviews',                   movieCtrl.getMovieReviews);

// GET /api/movies/:id/reviews/me             - Danh gia cua user hien tai
router.get('/:id/reviews/me',                verifyToken, movieCtrl.getMyMovieReview);

// POST /api/movies/:id/reviews               - Tao/cap nhat danh gia phim
router.post('/:id/reviews',                  verifyToken, movieCtrl.saveMovieReview);

module.exports = router;

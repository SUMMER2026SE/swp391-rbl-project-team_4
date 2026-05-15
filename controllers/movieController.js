// controllers/movieController.js
// const { getPool, sql } = require('../config/db'); // Uncomment khi kết nối DB thật

// ─── Dữ liệu mẫu (dùng tạm cho đến khi có DB) ───────────────────────────────
const SAMPLE_MOVIES = [
  { id: 1, title: 'Stellar Void', genre: 'Sci-Fi', rating: 8.4, duration: 142, status: 'now-showing', poster: '/assets/images/posters/poster_stellar_void.png' },
  { id: 2, title: 'Crimson Eclipse', genre: 'Thriller', rating: 7.9, duration: 118, status: 'now-showing', poster: '/assets/images/posters/poster_crimson_eclipse.png' },
  { id: 3, title: 'Neon Dynasty', genre: 'Action', rating: 8.1, duration: 135, status: 'now-showing', poster: '/assets/images/posters/poster_neon_dynasty.png' },
  { id: 4, title: 'Phantom Protocol', genre: 'Spy', rating: 7.6, duration: 128, status: 'coming-soon', poster: null },
  { id: 5, title: 'Abyss Rising', genre: 'Horror', rating: 7.3, duration: 110, status: 'coming-soon', poster: null },
];

// GET /api/movies/now-showing
exports.getNowShowing = async (req, res) => {
  try {
    // TODO: thay bằng query thật khi DB sẵn sàng
    // const pool = await getPool();
    // const result = await pool.request().query("SELECT * FROM Movies WHERE Status = 'now-showing'");
    // return res.json(result.recordset);

    const data = SAMPLE_MOVIES.filter(m => m.status === 'now-showing');
    res.json({ success: true, data });
  } catch (err) {
    console.error('[movieController] getNowShowing:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/movies/coming-soon
exports.getComingSoon = async (req, res) => {
  try {
    const data = SAMPLE_MOVIES.filter(m => m.status === 'coming-soon');
    res.json({ success: true, data });
  } catch (err) {
    console.error('[movieController] getComingSoon:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/movies/:id
exports.getMovieById = async (req, res) => {
  try {
    const movie = SAMPLE_MOVIES.find(m => m.id === parseInt(req.params.id));
    if (!movie) return res.status(404).json({ success: false, message: 'Movie not found' });
    res.json({ success: true, data: movie });
  } catch (err) {
    console.error('[movieController] getMovieById:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

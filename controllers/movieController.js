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
    if (BookingModel.ensureSchema) await BookingModel.ensureSchema();
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



// ─────────────────────────────────────────────────────────────
//  GET /api/movies/ai-recommendations
//  Gợi ý phim bằng AI dựa trên lịch sử xem phim
// ─────────────────────────────────────────────────────────────
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getPool } = require('../config/db');
const sql = require('mssql');

exports.getAiRecommendations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = await getPool();

    // 1. Lấy lịch sử xem phim của người dùng, bao gồm cả THỂ LOẠI
    const historyResult = await pool.request()
      .input('UserId', sql.Int, userId)
      .query(`
        SELECT DISTINCT m.Title,
          (SELECT STRING_AGG(g.GenreName, ', ') 
           FROM Movie_Genres mg 
           JOIN Genres g ON mg.GenreID = g.GenreID 
           WHERE mg.MovieID = m.MovieID) AS Genres
        FROM Tickets t
        JOIN Showtimes st ON t.ShowtimeID = st.ShowtimeID
        JOIN Movies m ON st.MovieID = m.MovieID
        WHERE t.UserID = @UserId AND t.Status IN ('confirmed', 'used')
      `);

    const watchedMovies = historyResult.recordset.map(r => `${r.Title} (Thể loại: ${r.Genres || 'Không xác định'})`);

    // 2. Lấy danh sách phim đang chiếu
    const nowShowingMovies = await MovieModel.getNowShowing();

    // Lọc bỏ những phim người dùng đã xem ra khỏi danh sách ứng cử viên
    const watchedTitles = historyResult.recordset.map(r => r.Title);
    let candidateMovies = nowShowingMovies.filter(m => !watchedTitles.includes(m.Title));

    // Nếu không có API KEY hoặc không có phim đang chiếu, fallback
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || nowShowingMovies.length === 0) {
       return res.json({ success: true, data: nowShowingMovies.slice(0, 3) });
    }

    // Nếu lọc xong mà không còn phim nào mới, thì đành lấy lại danh sách gốc
    if (candidateMovies.length === 0) {
       candidateMovies = nowShowingMovies;
    }

    // Nếu người dùng chưa xem phim nào, gợi ý ngẫu nhiên
    if (watchedMovies.length === 0) {
      return res.json({ success: true, data: nowShowingMovies.sort(() => 0.5 - Math.random()).slice(0, 3) });
    }

    const availableMoviesStr = candidateMovies.map(m => `- ID: ${m.MovieID} | Title: ${m.Title} | Genres: ${m.Genres} | Desc: ${m.Description}`).join('\n');
    const watchedStr = watchedMovies.join('; ');

    const prompt = `Bạn là hệ thống gợi ý phim AI.
Người dùng đã xem các phim (kèm thể loại): ${watchedStr}.
Danh sách phim đang chiếu:
${availableMoviesStr}

Dựa trên lịch sử xem phim (đặc biệt phân tích các THỂ LOẠI phim người dùng hay xem), hãy chọn ra 3 bộ phim CÓ THỂ LOẠI TƯƠNG ĐỒNG phù hợp nhất trong danh sách đang chiếu. KHÔNG CHỌN LẠI PHIM NGƯỜI DÙNG ĐÃ XEM TRỪ KHI KHÔNG CÒN PHIM NÀO KHÁC.
BẮT BUỘC trả về ĐÚNG ĐỊNH DẠNG JSON MẢNG (Array of JSON) chứa 3 phần tử, TUYỆT ĐỐI KHÔNG thêm bất kỳ văn bản nào bên ngoài mảng JSON (không có markdown \`\`\`json).
Mỗi object có cấu trúc:
{
  "MovieID": [ID phim],
  "Title": "[Tên phim]",
  "AiMatch": "[Số từ 70 đến 99]%",
  "AiReason": "[1 câu giải thích ngắn gọn vì sao gợi ý phim này dựa trên sở thích thể loại của khách hàng]"
}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Clean markdown blocks if AI still returns them
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    const aiRecommendations = JSON.parse(text);

    // Ghép dữ liệu AI với thông tin phim thực tế
    const finalData = aiRecommendations.map(aiMovie => {
      const dbMovie = nowShowingMovies.find(m => m.MovieID == aiMovie.MovieID);
      if (!dbMovie) return null;
      return {
        ...dbMovie,
        AiMatch: aiMovie.AiMatch,
        AiReason: aiMovie.AiReason
      };
    }).filter(m => m); // Lọc bỏ null

    if (finalData.length === 0) {
      return res.json({ success: true, data: nowShowingMovies.slice(0, 3) });
    }

    res.json({ success: true, data: finalData });

  } catch (err) {
    console.error('[movieController] getAiRecommendations:', err);
    // Fallback nếu lỗi AI
    try {
      const fallback = await MovieModel.getNowShowing();
      res.json({ success: true, data: fallback.slice(0, 3) });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
  }
};

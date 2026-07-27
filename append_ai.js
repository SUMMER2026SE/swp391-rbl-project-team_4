const fs = require('fs');

const code = `
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
      .query(\`
        SELECT DISTINCT m.Title,
          (SELECT STRING_AGG(g.GenreName, ', ') 
           FROM Movie_Genres mg 
           JOIN Genres g ON mg.GenreID = g.GenreID 
           WHERE mg.MovieID = m.MovieID) AS Genres
        FROM Bookings b
        JOIN Showtimes st ON b.ShowtimeID = st.ShowtimeID
        JOIN Movies m ON st.MovieID = m.MovieID
        WHERE b.UserID = @UserId AND b.PaymentStatus = 'Success'
      \`);

    const watchedMovies = historyResult.recordset.map(r => \`\${r.Title} (Thể loại: \${r.Genres || 'Không xác định'})\`);

    // 2. Lấy danh sách phim đang chiếu
    const nowShowingMovies = await MovieModel.getNowShowing();

    // Nếu không có API KEY hoặc không có phim đang chiếu, fallback
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || nowShowingMovies.length === 0) {
       return res.json({ success: true, data: nowShowingMovies.slice(0, 3) });
    }

    // Nếu người dùng chưa xem phim nào, gợi ý ngẫu nhiên
    if (watchedMovies.length === 0) {
      return res.json({ success: true, data: nowShowingMovies.sort(() => 0.5 - Math.random()).slice(0, 3) });
    }

    const availableMoviesStr = nowShowingMovies.map(m => \`- ID: \${m.MovieID} | Title: \${m.Title} | Genres: \${m.Genres} | Desc: \${m.Description}\`).join('\\n');
    const watchedStr = watchedMovies.join('; ');

    const prompt = \`Bạn là hệ thống gợi ý phim AI.
Người dùng đã xem các phim (kèm thể loại): \${watchedStr}.
Danh sách phim đang chiếu:
\${availableMoviesStr}

Dựa trên lịch sử xem phim (đặc biệt phân tích các THỂ LOẠI phim người dùng hay xem), hãy chọn ra 3 bộ phim CÓ THỂ LOẠI TƯƠNG ĐỒNG phù hợp nhất trong danh sách đang chiếu. KHÔNG CHỌN LẠI PHIM NGƯỜI DÙNG ĐÃ XEM TRỪ KHI KHÔNG CÒN PHIM NÀO KHÁC.
BẮT BUỘC trả về ĐÚNG ĐỊNH DẠNG JSON MẢNG (Array of JSON) chứa 3 phần tử, TUYỆT ĐỐI KHÔNG thêm bất kỳ văn bản nào bên ngoài mảng JSON (không có markdown \\\`\\\`\\\`json).
Mỗi object có cấu trúc:
{
  "MovieID": [ID phim],
  "Title": "[Tên phim]",
  "AiMatch": "[Số từ 70 đến 99]%",
  "AiReason": "[1 câu giải thích ngắn gọn vì sao gợi ý phim này dựa trên sở thích thể loại của khách hàng]"
}\`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Clean markdown blocks if AI still returns them
    if (text.startsWith('\`\`\`json')) text = text.replace(/\`\`\`json/g, '');
    if (text.startsWith('\`\`\`')) text = text.replace(/\`\`\`/g, '');
    text = text.trim();

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
`;

let content = fs.readFileSync('controllers/movieController.js', 'utf8');
content += '\n' + code;
fs.writeFileSync('controllers/movieController.js', content);
console.log('Appended successfully');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const MovieModel = require('../models/movieModel');

// NOTE: Do NOT instantiate GoogleGenerativeAI at module load time —
// the env loader hasn't injected GEMINI_API_KEY yet at that point.
// Instantiate lazily inside handleChat instead.

const chatController = {
  handleChat: async (req, res) => {
    try {
      const { message, history, language } = req.body;
      if (!message) {
        return res.status(400).json({ success: false, message: 'Message is required' });
      }

      // Lazy init — reads key after env is fully loaded
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('[ChatController] GEMINI_API_KEY is not set!');
        return res.status(500).json({ success: false, message: 'AI service not configured.' });
      }
      const genAI = new GoogleGenerativeAI(apiKey);

      const { getPool } = require('../config/db');
      const pool = await getPool();

      // 1. Lấy thông tin các Rạp chiếu
      const cinemasResult = await pool.request().query(`
        SELECT CinemaID, CinemaName, City, Address
        FROM Cinemas
      `);
      const cinemaList = cinemasResult.recordset || [];
      const cinemaContext = cinemaList.map(c => {
        return `- Mã rạp (CinemaID): ${c.CinemaID} | Tên rạp: ${c.CinemaName} | Thành phố: ${c.City || ''}`;
      }).join('\n');

      // 2. Lấy thông tin Phim đang chiếu
      const nowShowing = await MovieModel.getNowShowing();

      // 3. Lấy thông tin Suất chiếu (7 ngày tới)
      const showtimesResult = await pool.request().query(`
        SELECT st.ShowtimeID, st.MovieID, m.Title AS MovieTitle, st.RoomID, r.RoomName,
               c.CinemaID, c.CinemaName, st.StartTime, COALESCE(st.Price, st.BasePrice, 85000) AS Price
        FROM Showtimes st
        JOIN Movies m ON st.MovieID = m.MovieID
        JOIN Rooms r ON st.RoomID = r.RoomID
        JOIN Cinemas c ON r.CinemaID = c.CinemaID
        WHERE st.Status = 'active'
          AND st.StartTime >= DATEADD(HOUR, -3, GETDATE())
          AND st.StartTime <= DATEADD(DAY, 7, GETDATE())
        ORDER BY st.StartTime ASC
      `);

      const dateFormatter = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeFormatter = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });

      const showtimesByMovie = {};
      const allShowtimesList = [];

      (showtimesResult.recordset || []).forEach(st => {
        if (!showtimesByMovie[st.MovieID]) showtimesByMovie[st.MovieID] = [];
        const t = new Date(st.StartTime);
        const dStr = dateFormatter.format(t);
        const tStr = timeFormatter.format(t);
        const showtimeItemStr = `${dStr} ${tStr} tại ${st.CinemaName} (CinemaID=${st.CinemaID}, ShowtimeID=${st.ShowtimeID})`;
        showtimesByMovie[st.MovieID].push(showtimeItemStr);

        allShowtimesList.push(`- [ShowtimeID: ${st.ShowtimeID}] Phim: "${st.MovieTitle}" (MovieID=${st.MovieID}) | Rạp: "${st.CinemaName}" (CinemaID=${st.CinemaID}) | Ngày: ${dStr} lúc ${tStr} | Phòng: ${st.RoomName}`);
      });

      // Lọc các phim duy nhất
      const uniqueMovies = [];
      const seenTitles = new Set();
      for (const movie of nowShowing) {
        if (!seenTitles.has(movie.Title)) {
          seenTitles.add(movie.Title);
          uniqueMovies.push(movie);
        }
      }

      const movieContext = uniqueMovies.map(m => {
        const showList = showtimesByMovie[m.MovieID] || [];
        const showtimesStr = showList.length > 0 ? showList.join('; ') : 'Chưa có lịch chiếu trong 7 ngày tới';
        return `- Mã phim (MovieID): ${m.MovieID} | Phim: ${m.Title} | Poster: ${m.PosterURL || ''} | Thời lượng: ${m.Duration} phút | Nội dung: ${m.Description || ''} | Các suất chiếu: ${showtimesStr}`;
      }).join('\n');

      const fullShowtimeContext = allShowtimesList.length > 0
        ? allShowtimesList.join('\n')
        : 'Hiện không có suất chiếu nào khả dụng.';

      // Check if user is Admin
      let isAdmin = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const jwt = require('jsonwebtoken');
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
          if (decoded.roleName === 'Admin' || decoded.roleId === 1) {
            isAdmin = true;
          }
        } catch (e) {
          // ignore token error
        }
      }

      let adminContext = '';
      if (isAdmin) {
        adminContext = `
[CHẾ ĐỘ DÀNH CHO QUẢN TRỊ VIÊN - ADMIN MODE]
CẢNH BÁO: NGƯỜI ĐANG TRÒ CHUYỆN VỚI BẠN LÀ ADMIN (QUẢN TRỊ VIÊN) CỦA HỆ THỐNG D-CINEMA.
1. Xưng hô: Gọi người này là "Sếp" hoặc "Quản trị viên", xưng "mình" hoặc "trợ lý AI". Phải thể hiện thái độ báo cáo chuyên nghiệp.
2. Tư vấn lịch chiếu: Phân tích lịch chiếu và gợi ý lịch sắp xếp tối ưu.
3. Hỗ trợ dữ liệu nội bộ: Trả lời thông tin chiến lược chuyên nghiệp.
`;
      }

      const currentDateTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const isEn = language === 'en';
      const lblRating = isEn ? "Rating" : "Đánh giá";
      const lblDuration = isEn ? "Duration" : "Thời lượng";
      const lblTodayShowtimes = isEn ? "Showtimes" : "Lịch chiếu";
      const lblSelectedShowtime = isEn ? "Selected showtime" : "Suất chiếu đã chọn";
      const btnBookNow = isEn ? "BOOK NOW" : "ĐẶT VÉ NGAY";
      const btnSelectSeat = isEn ? "SELECT SEAT" : "CHỌN GHẾ NGAY";

      const htmlTemplate1 = `<div class="bot-movie-card"><img src="/[Link Poster]" class="bot-movie-poster" /><h4 class="bot-movie-title">[TÊN PHIM]</h4><span class="bot-movie-rating">⭐ ${lblRating}: 4.9/5</span><p class="bot-movie-duration">${lblDuration}: [Thời lượng]</p><div class="bot-showtimes-wrapper">${lblTodayShowtimes}:<div class="bot-showtimes-grid"><span class="bot-showtime-badge">[Giờ chiếu]</span></div></div><a href="/booking.html?movieId=[Mã phim]&cinemaId=[Mã rạp]" target="_parent" class="bot-book-btn">${btnBookNow}</a></div>`;

      const htmlTemplate2 = `<div class="bot-movie-card"><img src="/[Link Poster]" class="bot-movie-poster" /><h4 class="bot-movie-title">[TÊN PHIM]</h4><span class="bot-movie-rating">⭐ ${lblRating}: 4.9/5</span><p class="bot-movie-duration" style="text-align: left; font-style: italic;">[Nội dung tóm tắt]</p><div class="bot-showtimes-wrapper">${lblSelectedShowtime}:<div class="bot-showtimes-grid"><span class="bot-showtime-badge">[Tên Rạp] - [Ngày - Giờ chiếu]</span></div></div><a href="/seats.html?showtimeId={{ID_SUAT_CHIEU}}" target="_parent" class="bot-book-btn">${btnSelectSeat}</a></div>`;

      const prompt = `Bạn là MovieBot, trợ lý ảo thông minh và thân thiện của hệ thống rạp chiếu phim D-CINEMA.
Nhiệm vụ của bạn là hỗ trợ khách hàng giải đáp thắc mắc, hướng dẫn đặt vé, tra cứu lịch chiếu, và tư vấn dịch vụ.
LUÔN xưng hô là "mình" và gọi khách hàng là "bạn" (Trừ khi ở chế độ Admin). Trả lời ngắn gọn, súc tích, chuyên nghiệp và nhiệt tình.
Hôm nay là: ${currentDateTime} (Múi giờ Việt Nam).

${adminContext}

[DỮ LIỆU HỆ THỐNG D-CINEMA]
1. DANH SÁCH RẠP CHIẾU (Cinemas):
${cinemaContext}

2. DANH SÁCH PHIM ĐANG CHIẾU (Movies):
${movieContext}

3. DANH SÁCH SUẤT CHIẾU CHI TIẾT (7 NGÀY TỚI):
${fullShowtimeContext}

[QUY TẮC BẮT BUỘC KHI TẠO LINK ĐẶT VÉ]:
- Tên phim trong câu trả lời LUÔN LUÔN viết IN HOA TOÀN BỘ và in đậm (Ví dụ: <b>ỐC MƯỢN HỒN</b>).
- KHÔNG dùng dấu sao (**) để in đậm (Markdown). Dùng thẻ <b>...</b> của HTML.

1. TRƯỜNG HỢP 1 (Hỏi thông tin phim hoặc muốn đặt vé ở trang tổng quan):
   Dùng mẫu HTML 1:
   ${htmlTemplate1}
   - [Link Poster]: đường dẫn ảnh poster của phim.
   - [Mã phim]: đúng MovieID của phim đó.
   - [Mã rạp]: đúng CinemaID của rạp khách hỏi. NẾU KHÁCH KHÔNG NÓI RẠP NÀO, BỎ THUỘC TÍNH &cinemaId=[Mã rạp] (tức là chỉ href="/booking.html?movieId=[Mã phim]").

2. TRƯỜNG HỢP 2 (Khách yêu cầu đặt một suất chiếu CỤ THỂ theo Giờ + Rạp + Phim):
   Dùng mẫu HTML 2 (nhảy thẳng bước chọn ghế):
   ${htmlTemplate2}
   - ĐỐI CHIẾU CHÍNH XÁC: Tra cứu trong "DANH SÁCH SUẤT CHIẾU CHI TIẾT" để tìm đúng ShowtimeID tương ứng với Phim + Rạp + Ngày Giờ khách chọn.
   - Thay {{ID_SUAT_CHIEU}} bằng đúng con số ShowtimeID đó (ví dụ: href="/seats.html?showtimeId=15").
   - NẾU KHÔNG TÌM THẤY SUẤT CHIẾU KHỚP HOẶC KHÁCH CHƯA NÓI RÕ SUẤT NÀO: Dùng Mẫu 1 (dẫn tới /booking.html?movieId=...&cinemaId=...) để khách tự chọn trên giao diện.

TUYỆT ĐỐI KHÔNG BỊA RA MOVIE ID, CINEMA ID HOẶC SHOWTIME ID KHÔNG CÓ TRONG DỮ LIỆU.
TUYỆT ĐỐI KHÔNG ĐƯỢC XUỐNG DÒNG BÊN TRONG CÁC THẺ HTML CỦA MẪU CARD.

${language === 'en' ? 'Ngôn ngữ người dùng: Tiếng Anh. Trả lời toàn bộ bằng Tiếng Anh.' : 'Ngôn ngữ người dùng: Tiếng Việt.'}`;

      const model = genAI.getGenerativeModel({
        model: "gemini-flash-lite-latest",
        systemInstruction: prompt
      });

      const chat = model.startChat({
        history: history ? history.slice(-10) : []
      });

      const result = await chat.sendMessage(message);
      const responseText = result.response.text();

      return res.json({ success: true, reply: responseText });
    } catch (error) {
      console.error('Chat API Error:', error);
      return res.json({
        success: true,
        reply: "Xin lỗi bạn, hiện tại hệ thống trí tuệ nhân tạo của rạp đang bảo trì để nâng cấp trải nghiệm. Bạn có thể liên hệ trực tiếp Hotline 1900-1234 để mình hỗ trợ nhanh nhất nhé!"
      });
    }
  }
};

module.exports = chatController;

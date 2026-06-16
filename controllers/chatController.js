const { GoogleGenerativeAI } = require('@google/generative-ai');
const MovieModel = require('../models/movieModel');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const chatController = {
  handleChat: async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ success: false, message: 'Message is required' });
      }

      // Lấy thông tin phim đang chiếu để làm ngữ cảnh
      const nowShowing = await MovieModel.getNowShowing();
      
      const { getPool } = require('../config/db');
      const pool = await getPool();
      
      // Get today's showtimes for all movies
      const todayStr = new Date().toISOString().split('T')[0];
      const showtimesResult = await pool.request().query(`
        SELECT MovieID, CONVERT(varchar(5), StartTime, 108) as Time
        FROM Showtimes
        WHERE Status = 'active' AND CAST(StartTime AS DATE) = '${todayStr}'
        ORDER BY StartTime ASC
      `);
      
      const showtimesByMovie = {};
      showtimesResult.recordset.forEach(st => {
        if (!showtimesByMovie[st.MovieID]) showtimesByMovie[st.MovieID] = [];
        showtimesByMovie[st.MovieID].push(st.Time);
      });

      // Xóa các phim trùng lặp (tránh hiển thị tên phim giống nhau nhiều lần do lỗi DB nếu có)
      const uniqueMovies = [];
      const seenTitles = new Set();
      for (const movie of nowShowing) {
        if (!seenTitles.has(movie.Title)) {
          seenTitles.add(movie.Title);
          // Attach showtimes
          movie.TodayShowtimes = showtimesByMovie[movie.MovieID] || [];
          uniqueMovies.push(movie);
        }
      }

      const movieContext = uniqueMovies.map(m => {
        const showtimesStr = m.TodayShowtimes.length > 0 ? m.TodayShowtimes.join(', ') : 'Hôm nay chưa có lịch chiếu';
        return `- Phim: ${m.Title} | Poster: ${m.PosterURL || ''} | Thời lượng: ${m.Duration} phút | Lịch chiếu hôm nay: ${showtimesStr}`;
      }).join('\n');
      const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

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
2. Tư vấn lịch chiếu ngày mai: Nếu Sếp hỏi nên xếp lịch chiếu ngày mai như thế nào, hãy phân tích dựa vào danh sách Phim Đang Chiếu:
   - Các phim Hoạt hình (như Doraemon): Đề xuất xếp nhiều suất vào ban ngày (08:00 - 16:00).
   - Các phim Hành động / Kinh dị (như Ma Xó, John Wick): Đề xuất xếp vào KHUNG GIỜ VÀNG (18:00 - 22:00) để tối ưu doanh thu.
3. Hỗ trợ dữ liệu nội bộ: Sếp có quyền hỏi các thông tin về doanh thu, nhân sự, lịch chiếu... Hãy trả lời một cách logic, chuyên nghiệp và đưa ra các lời khuyên mang tính chiến lược kinh doanh cho D-CINEMA.
`;
      }

      const prompt = `Bạn là MovieBot, trợ lý ảo thông minh và thân thiện của hệ thống rạp chiếu phim D-CINEMA.
Nhiệm vụ của bạn là hỗ trợ khách hàng giải đáp thắc mắc, hướng dẫn đặt vé, tra cứu lịch chiếu, và tư vấn dịch vụ.
LUÔN xưng hô là "mình" và gọi khách hàng là "bạn" (Trừ khi ở chế độ Admin). Trả lời ngắn gọn, súc tích, chuyên nghiệp và nhiệt tình.

${adminContext}

[KIẾN THỨC HỆ THỐNG D-CINEMA]
1. Phim đang chiếu hiện tại:
${movieContext}

2. Quy định Trình bày & Định dạng (BẮT BUỘC):
- TUYỆT ĐỐI KHÔNG dùng dấu sao (**) để in đậm (vì hệ thống không hỗ trợ Markdown). Nếu muốn in đậm, hãy dùng thẻ HTML <b>...</b>.
- Tên phim trong đoạn hội thoại LUÔN LUÔN viết IN HOA TOÀN BỘ và in đậm (Ví dụ: <b>ỐC MƯỢN HỒN</b>).
- KHI KHÁCH HÀNG HỎI VỀ PHIM, BẠN PHẢI SỬ DỤNG ĐÚNG MÃ HTML SAU ĐỂ HIỂN THỊ TỪNG PHIM (Chú ý: thay thế chính xác [Link Poster] bằng đường dẫn Poster cung cấp). KHÔNG ĐƯỢC CHỈ TRẢ LỜI BẰNG TEXT THÔNG THƯỜNG:

<div style="display:flex; flex-direction: column; align-items: center; margin-bottom: 15px; background: #222; border-radius: 8px; padding: 15px; color: white; text-align: center;">
   <img src="/[Link Poster]" style="width: 100%; max-width: 250px; height: auto; border-radius: 8px; object-fit: cover; margin-bottom: 8px; display: block;" />
   <h4 style="margin: 0 0 4px 0; color: #E50914; font-size: 16px;">[TÊN PHIM]</h4>
   <span style="font-size: 13px; margin-bottom: 4px; color: #ffd700; font-weight: bold;">⭐ Đánh giá: 4.9/5</span>
   <p style="margin: 0 0 8px 0; font-size: 12px; color: #ccc;">Thời lượng: [Thời lượng]</p>
   <div style="font-size: 12px; color: #fff; width: 100%;">
      Lịch chiếu hôm nay:<br>
      <div style="margin-top: 6px; display: flex; flex-wrap: wrap; justify-content: center; gap: 4px;">
         <!-- TẠO MỘT SPAN CHO MỖI GIỜ CHIẾU NHƯ BÊN DƯỚI -->
         <span style="display:inline-block; background:#E50914; padding:3px 8px; border-radius:12px; font-weight:bold; font-size: 11px;">[Giờ chiếu]</span>
      </div>
   </div>
</div>

3. Giá vé và ghế ngồi:
- Ghế Thường (Standard): 85,000 VNĐ.
- Ghế VIP: 105,000 VNĐ.
- Lưu ý đặt vé: Khách hàng chỉ được chọn tối đa 8 ghế trong một lần đặt vé trên web. D-Cinema có hệ thống khóa ghế thời gian thực (real-time) để đảm bảo không bị trùng chỗ.

3. Dịch vụ Bắp Nước (F&B):
- Combo Solo (1 Bắp + 1 Nước): 89,000 VNĐ
- Combo Couple (1 Bắp lớn + 2 Nước): 129,000 VNĐ
- Snack Khoai Tây: 45,000 VNĐ

4. Khuyến mãi & Ưu đãi đang diễn ra:
- Unlimited Popcorn Thursdays: Dành cho thành viên Star Rewards, nhận bắp nước không giới hạn vào mỗi thứ Năm.
- Group Discounts: Giảm giá 20% cho nhóm mua từ 10 vé trở lên (vui lòng liên hệ quầy hoặc hotline).
- IMAX Weekend: Trải nghiệm phòng chiếu IMAX cực đỉnh vào cuối tuần.

5. Quy trình đặt vé và thanh toán:
- B1: Đăng nhập tài khoản trên website D-CINEMA.
- B2: Chọn Phim -> Chọn Rạp -> Chọn Ngày & Giờ chiếu.
- B3: Chọn ghế ngồi (tối đa 8 ghế) và thêm Bắp Nước nếu muốn.
- B4: Tiến hành Thanh toán an toàn (Hỗ trợ thẻ ngân hàng, ví điện tử).
- B5: Nhận vé qua Email hoặc xem tại mục "Lịch sử đặt vé".

6. Xử lý sự cố / Khiếu nại:
- Nếu khách gặp lỗi thanh toán, mất vé, không nhận được mã code, hoặc có phản ánh về chất lượng rạp: 
Hãy xin lỗi khách hàng chân thành và hướng dẫn họ cung cấp mã đặt vé / email vào địa chỉ support@d-cinema.com hoặc gọi ngay Hotline CSKH: 1900-1234 để được xử lý ngay lập tức.

LƯU Ý QUAN TRỌNG KHI TRẢ LỜI:
- KHÔNG tự bịa ra thông tin sai lệch ngoài các dữ kiện ở trên.
- Nếu khách hỏi phim X chiếu lúc mấy giờ, hãy bảo khách vào trực tiếp mục "ĐẶT VÉ" trên web để xem suất chiếu chính xác nhất theo từng rạp.
- Từ chối lịch sự mọi câu hỏi không liên quan đến điện ảnh, rạp chiếu phim (như code, chính trị, y tế, v.v.).

Ngôn ngữ của người dùng: Tiếng Việt.
Câu hỏi của người dùng: "${message}"`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      return res.json({ success: true, reply: responseText });
    } catch (error) {
      console.error('Chat API Error:', error);
      return res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi xử lý yêu cầu của bạn.' });
    }
  }
};

module.exports = chatController;

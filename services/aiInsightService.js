const { GoogleGenerativeAI } = require('@google/generative-ai');

function getGeminiApiKey() {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

function money(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
}

function percent(value) {
  const number = Number(value || 0);
  return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function compactMovie(movie = {}) {
  return {
    movieId: movie.MovieID || movie.movieId || null,
    title: movie.Title || movie.MovieTitle || movie.title || 'Không rõ',
    tickets: Number(movie.TotalTickets || movie.TicketsSold || movie.tickets || 0),
    revenue: Number(movie.TodayRevenue || movie.TotalRevenue || movie.revenue || 0)
  };
}

function compactTransaction(txn = {}) {
  return {
    branch: txn.branch || txn.CinemaName || '',
    item: txn.item || txn.MovieTitle || '',
    amount: Number(txn.amount || txn.TotalAmount || 0),
    status: txn.status || txn.Status || ''
  };
}

function buildFallbackInsight(data = {}) {
  const stats = data.stats || {};
  const topMovies = Array.isArray(data.topMovies) ? data.topMovies : [];
  const recentTxns = Array.isArray(data.recentTxns) ? data.recentTxns : [];
  const topMovie = topMovies[0] ? compactMovie(topMovies[0]) : null;
  const revenue = Number(stats.TotalRevenue || 0);
  const fnb = Number(stats.FnBSales || 0);
  const tickets = Number(stats.TicketSales || 0);
  const occupancy = Number(stats.OccupancyRate || 0);

  const highlights = [];
  if (topMovie) {
    highlights.push(`Phim nổi bật nhất hiện tại là ${topMovie.title} với ${topMovie.tickets} vé và doanh thu ${money(topMovie.revenue)}.`);
  }
  if (recentTxns.length > 0) {
    highlights.push(`Hệ thống ghi nhận ${recentTxns.length} giao dịch gần đây trong dữ liệu phân tích.`);
  }
  if (fnb > 0 && revenue > 0) {
    highlights.push(`Doanh thu F&B chiếm khoảng ${percent((fnb / revenue) * 100)} tổng doanh thu.`);
  }

  const risks = [];
  if (occupancy < 35) risks.push('Tỷ lệ lấp đầy đang thấp, cần kiểm tra lịch chiếu hoặc chương trình khuyến mãi.');
  if (tickets === 0) risks.push('Chưa có dữ liệu vé bán trong bộ lọc hiện tại.');
  if (fnb === 0) risks.push('Doanh thu F&B bằng 0 hoặc chưa có dữ liệu, nên kiểm tra dữ liệu combo/bắp nước.');
  if (risks.length === 0) risks.push('Chưa phát hiện rủi ro lớn từ các chỉ số tổng quan.');

  return [
    'Tổng quan',
    `Doanh thu hiện tại đạt ${money(revenue)}, bán được ${tickets} vé, doanh thu F&B là ${money(fnb)}, tỷ lệ lấp đầy ${percent(occupancy)}.`,
    '',
    'Điểm nổi bật',
    highlights.length ? highlights.map(item => `- ${item}`).join('\n') : '- Chưa đủ dữ liệu để xác định điểm nổi bật.',
    '',
    'Vấn đề cần chú ý',
    risks.map(item => `- ${item}`).join('\n'),
    '',
    'Đề xuất hành động',
    '- Ưu tiên theo dõi các phim đang có doanh thu cao để cân nhắc tăng suất ở khung giờ tối.',
    '- Nếu tỷ lệ lấp đầy thấp, thử khuyến mãi combo hoặc voucher cho suất sáng/giờ thấp điểm.',
    '- Kiểm tra rạp hoặc phim có giao dịch thấp để điều chỉnh lịch chiếu và truyền thông.'
  ].join('\n');
}

function buildRevenuePrompt(data) {
  return `
Bạn là trợ lý phân tích vận hành cho hệ thống rạp phim D-CINEMA.
Hãy phân tích dữ liệu doanh thu admin dưới đây bằng tiếng Việt.

Yêu cầu bắt buộc:
- Không bịa số liệu ngoài JSON.
- Nếu thiếu dữ liệu, nói rõ là thiếu dữ liệu.
- Viết ngắn gọn, thực tế, ưu tiên hành động.
- Không dùng bảng Markdown.
- Trả về đúng 4 phần: Tổng quan, Điểm nổi bật, Vấn đề cần chú ý, Đề xuất hành động.
- Mỗi phần 1-3 gạch đầu dòng hoặc câu ngắn.

Dữ liệu:
${JSON.stringify(data, null, 2)}
`;
}

async function generateRevenueInsight(rawData = {}) {
  const data = {
    generatedAt: new Date().toISOString(),
    period: rawData.period || 'all',
    cinemaId: rawData.cinemaId || null,
    stats: rawData.stats || {},
    topMovies: (rawData.topMovies || []).slice(0, 8).map(compactMovie),
    recentTransactions: (rawData.recentTxns || []).slice(0, 12).map(compactTransaction),
    monthlyRevenue: (rawData.monthlyRevenue || []).slice(-12),
    revenueSummary: rawData.revenueStats ? rawData.revenueStats.summary : null
  };

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { provider: 'fallback', insight: buildFallbackInsight(rawData) };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });
    const result = await model.generateContent(buildRevenuePrompt(data));
    const insight = result.response.text().trim();
    return { provider: 'gemini', insight: insight || buildFallbackInsight(rawData) };
  } catch (error) {
    console.error('[aiInsightService] Gemini revenue insight failed:', error.message);
    return {
      provider: 'fallback',
      warning: 'Gemini không phản hồi, đã dùng phân tích dự phòng.',
      insight: buildFallbackInsight(rawData)
    };
  }
}

function minutesFromTime(time) {
  const [hour, minute] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function timeFromMinutes(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function compactScheduleMovie(movie = {}, topMovies = []) {
  const topIndex = topMovies.findIndex(item => Number(item.MovieID) === Number(movie.MovieID));
  return {
    movieId: movie.MovieID,
    title: movie.Title || movie.MovieTitle || 'Không rõ',
    duration: Number(movie.Duration || 120),
    status: movie.Status || '',
    genres: movie.Genres || '',
    hotRank: topIndex >= 0 ? topIndex + 1 : null,
    tickets: topIndex >= 0 ? Number(topMovies[topIndex].TotalTickets || 0) : 0
  };
}

function compactScheduleRoom(room = {}) {
  return {
    roomId: room.RoomID,
    name: room.RoomName || 'Phòng',
    type: room.RoomType || 'Standard',
    seats: Number(room.TotalSeats || 0),
    cinemaId: room.CinemaID,
    cinemaName: room.CinemaName || ''
  };
}

function compactScheduleShowtime(showtime = {}) {
  const start = showtime.StartTime ? new Date(showtime.StartTime) : null;
  const end = showtime.EndTime ? new Date(showtime.EndTime) : null;
  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' };
  return {
    movie: showtime.MovieTitle || '',
    roomId: showtime.RoomID,
    room: showtime.RoomName || '',
    start: start && !Number.isNaN(start.getTime()) ? start.toLocaleTimeString('vi-VN', timeOptions) : '',
    end: end && !Number.isNaN(end.getTime()) ? end.toLocaleTimeString('vi-VN', timeOptions) : '',
    seats: Number(showtime.TotalSeats || 0),
    sold: Number(showtime.TicketsSold || 0),
    status: showtime.Status || ''
  };
}

function buildSchedulePrompt(data) {
  return `
Bạn là trợ lý xếp lịch chiếu phim cho hệ thống rạp D-CINEMA.
Hãy gợi ý lịch chiếu tối ưu bằng tiếng Việt cho ngày và rạp dưới đây.

Yêu cầu bắt buộc:
- Không tạo lịch trùng phòng với existingShowtimes.
- Ưu tiên khung giờ cao điểm 18:00-22:30 cho phim hot.
- Nếu phim hot, ưu tiên phòng nhiều ghế; phim ít dữ liệu hoặc ít khách, ưu tiên phòng nhỏ/vừa.
- Mỗi đề xuất cần có phim, phòng, giờ bắt đầu - kết thúc và lý do ngắn.
- Không dùng bảng Markdown.
- Nếu thiếu dữ liệu phòng, phim hoặc rạp, nói rõ thiếu dữ liệu.

Dữ liệu:
${JSON.stringify(data, null, 2)}
`;
}

function buildFallbackScheduleSuggestion(rawData = {}) {
  const rooms = (rawData.rooms || []).map(compactScheduleRoom).filter(room => room.roomId);
  const topMovies = rawData.topMovies || [];
  const movies = (rawData.movies || [])
    .map(movie => compactScheduleMovie(movie, topMovies))
    .filter(movie => movie.movieId && movie.duration > 0);
  const selectedMovieId = rawData.movieId ? Number(rawData.movieId) : null;
  const candidates = selectedMovieId
    ? movies.filter(movie => Number(movie.movieId) === selectedMovieId)
    : movies
        .slice()
        .sort((a, b) => {
          const rankA = a.hotRank || 999;
          const rankB = b.hotRank || 999;
          if (rankA !== rankB) return rankA - rankB;
          return b.tickets - a.tickets;
        })
        .slice(0, 4);

  if (!rooms.length) return 'Chưa có dữ liệu phòng chiếu để AI gợi ý lịch.';
  if (!candidates.length) return 'Chưa có dữ liệu phim phù hợp để AI gợi ý lịch.';

  const occupied = new Map();
  (rawData.existingShowtimes || []).forEach(showtime => {
    const compact = compactScheduleShowtime(showtime);
    const start = minutesFromTime(compact.start);
    const end = minutesFromTime(compact.end);
    if (!compact.roomId || start === null || end === null) return;
    const list = occupied.get(compact.roomId) || [];
    list.push({ start, end });
    occupied.set(compact.roomId, list);
  });

  const sortedRooms = rooms.slice().sort((a, b) => b.seats - a.seats);
  const peakSlots = ['18:00', '19:30', '20:30', '21:30'];
  const normalSlots = ['09:30', '11:45', '14:00', '16:15', '18:30', '20:45', '22:15'];
  const suggestions = [];

  function canUse(roomId, start, end) {
    const list = occupied.get(roomId) || [];
    return !list.some(item => !(end <= item.start || start >= item.end));
  }

  function reserve(roomId, start, end) {
    const list = occupied.get(roomId) || [];
    list.push({ start, end });
    occupied.set(roomId, list);
  }

  candidates.forEach(movie => {
    const isHot = movie.hotRank && movie.hotRank <= 3;
    const slots = isHot ? peakSlots.concat(normalSlots) : normalSlots.concat(peakSlots);
    const preferredRooms = isHot ? sortedRooms : sortedRooms.slice().reverse();
    let chosen = null;

    for (const room of preferredRooms) {
      for (const slot of slots) {
        const start = minutesFromTime(slot);
        if (start === null) continue;
        const end = start + movie.duration + 15;
        if (!canUse(room.roomId, start, end)) continue;
        chosen = { room, start, end };
        break;
      }
      if (chosen) break;
    }

    if (chosen) {
      reserve(chosen.room.roomId, chosen.start, chosen.end);
      suggestions.push({
        movie,
        room: chosen.room,
        start: timeFromMinutes(chosen.start),
        end: timeFromMinutes(chosen.end),
        reason: isHot
          ? 'phim đang có sức hút, nên ưu tiên phòng nhiều ghế và khung giờ tối'
          : 'phim cần thêm suất ổn định, ưu tiên phòng vừa/nhỏ để giữ tỷ lệ lấp đầy'
      });
    }
  });

  if (!suggestions.length) {
    return 'Tất cả khung giờ gợi ý đều bị trùng với lịch hiện có. Nên kiểm tra lại ngày chiếu hoặc mở thêm phòng trống.';
  }

  return [
    'Gợi ý xếp lịch chiếu',
    ...suggestions.map((item, index) => (
      `${index + 1}. ${item.movie.title} - ${item.room.name} (${item.room.seats} ghế): ${item.start} - ${item.end}. Lý do: ${item.reason}.`
    )),
    '',
    'Lưu ý',
    '- Các khung giờ trên đã né lịch phòng đang có trong ngày được chọn.',
    '- Khi lưu suất chiếu, backend vẫn sẽ kiểm tra trùng phòng lần cuối.'
  ].join('\n');
}

async function generateScheduleSuggestions(rawData = {}) {
  const topMovies = rawData.topMovies || [];
  const data = {
    generatedAt: new Date().toISOString(),
    date: rawData.date || null,
    cinema: rawData.cinema || null,
    selectedMovieId: rawData.movieId || null,
    movies: (rawData.movies || []).slice(0, 12).map(movie => compactScheduleMovie(movie, topMovies)),
    rooms: (rawData.rooms || []).map(compactScheduleRoom),
    existingShowtimes: (rawData.existingShowtimes || []).map(compactScheduleShowtime),
    topMovies: topMovies.slice(0, 8).map(compactMovie)
  };

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { provider: 'fallback', suggestion: buildFallbackScheduleSuggestion(rawData) };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });
    const result = await model.generateContent(buildSchedulePrompt(data));
    const suggestion = result.response.text().trim();
    return { provider: 'gemini', suggestion: suggestion || buildFallbackScheduleSuggestion(rawData) };
  } catch (error) {
    console.error('[aiInsightService] Gemini schedule suggestion failed:', error.message);
    return {
      provider: 'fallback',
      warning: 'Gemini không phản hồi, đã dùng gợi ý dự phòng.',
      suggestion: buildFallbackScheduleSuggestion(rawData)
    };
  }
}

function classifyAdminQuestion(question) {
  const text = normalizeText(question);

  if (!text.trim()) return { intent: 'unknown', confidence: 0 };
  if (text.includes('rap') && text.includes('doanh thu') &&
    (text.includes('cao nhat') || text.includes('nhieu nhat') || text.includes('top') || text.includes('hom nay'))) {
    return { intent: 'top_cinema_revenue_today', confidence: 0.94 };
  }
  if (text.includes('phim') &&
    (text.includes('ban it') || text.includes('it ve') || text.includes('thap nhat') || text.includes('kem nhat') || text.includes('e nhat')) &&
    (text.includes('tuan') || text.includes('7 ngay') || text.includes('nay'))) {
    return { intent: 'least_sold_movie_this_week', confidence: 0.92 };
  }
  if ((text.includes('suat') || text.includes('lich chieu')) &&
    (text.includes('ghe trong') || text.includes('con nhieu ghe') || text.includes('nhieu ghe trong') || text.includes('trong nhieu'))) {
    return { intent: 'showtimes_most_empty_seats', confidence: 0.93 };
  }
  if (text.includes('phim') &&
    (text.includes('ban chay') || text.includes('nhieu ve') || text.includes('doanh thu cao') || text.includes('top'))) {
    return { intent: 'top_movie_today', confidence: 0.86 };
  }
  if ((text.includes('suat') || text.includes('phong') || text.includes('rap')) &&
    (text.includes('lap day thap') || text.includes('it khach') || text.includes('vang') || text.includes('ti le thap') || text.includes('ty le thap'))) {
    return { intent: 'low_occupancy_showtimes', confidence: 0.86 };
  }

  return { intent: 'unknown', confidence: 0.25 };
}

function compactAdminQueryRows(rows = []) {
  return rows.slice(0, 8).map(row => ({
    cinema: row.CinemaName || '',
    city: row.City || '',
    movie: row.Title || row.MovieTitle || '',
    room: row.RoomName || '',
    ticketsSold: Number(row.TicketsSold || 0),
    totalSeats: Number(row.TotalSeats || 0),
    emptySeats: Number(row.EmptySeats || 0),
    occupancyRate: Number(row.OccupancyRate || 0),
    totalRevenue: Number(row.TotalRevenue || 0),
    startTime: row.StartTime || '',
    endTime: row.EndTime || '',
    status: row.Status || ''
  }));
}

function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh'
  });
}

function formatAdminQueryFallback(question, intent, rows = []) {
  if (!rows.length) {
    return 'Chưa có dữ liệu phù hợp với câu hỏi này trong database.';
  }

  const first = rows[0] || {};
  if (intent === 'top_cinema_revenue_today') {
    return [
      `Hôm nay, rạp có doanh thu cao nhất là ${first.CinemaName || 'không rõ'} (${first.City || 'không rõ'}).`,
      `Doanh thu: ${money(first.TotalRevenue)}, số vé: ${first.TicketsSold || 0}.`,
      `Có ${rows.length} rạp có dữ liệu doanh thu trong kết quả.`
    ].join('\n');
  }

  if (intent === 'least_sold_movie_this_week') {
    return [
      `Phim bán ít vé nhất trong 7 ngày gần đây là ${first.Title || 'không rõ'}.`,
      `Số vé: ${first.TicketsSold || 0}, doanh thu: ${money(first.TotalRevenue)}.`,
      'Nên kiểm tra lịch chiếu, khung giờ và ưu đãi cho phim này.'
    ].join('\n');
  }

  if (intent === 'showtimes_most_empty_seats') {
    return [
      `Suất chiếu còn nhiều ghế trống nhất là ${first.MovieTitle || 'không rõ'} tại ${first.CinemaName || 'không rõ'} - ${first.RoomName || 'không rõ'}.`,
      `Còn trống ${first.EmptySeats || 0}/${first.TotalSeats || 0} ghế, đã bán ${first.TicketsSold || 0} vé.`,
      `Giờ chiếu: ${formatDateTime(first.StartTime)}.`
    ].join('\n');
  }

  if (intent === 'top_movie_today') {
    return [
      `Hôm nay, phim bán tốt nhất là ${first.Title || 'không rõ'}.`,
      `Đã bán ${first.TicketsSold || 0} vé, doanh thu ${money(first.TotalRevenue)}.`,
      'Có thể cân nhắc tăng suất ở khung giờ cao điểm nếu còn phòng.'
    ].join('\n');
  }

  if (intent === 'low_occupancy_showtimes') {
    return [
      `Suất có tỷ lệ lấp đầy thấp nhất là ${first.MovieTitle || 'không rõ'} tại ${first.CinemaName || 'không rõ'} - ${first.RoomName || 'không rõ'}.`,
      `Tỷ lệ lấp đầy ${percent(first.OccupancyRate)}, đã bán ${first.TicketsSold || 0}/${first.TotalSeats || 0} ghế.`,
      `Giờ chiếu: ${formatDateTime(first.StartTime)}.`
    ].join('\n');
  }

  return `Đã tìm thấy ${rows.length} dòng dữ liệu liên quan đến câu hỏi: "${question}".`;
}

function buildAdminQueryPrompt({ question, intent, rows }) {
  return `
Bạn là trợ lý dữ liệu cho admin rạp phim D-CINEMA.
Trả lời câu hỏi bằng tiếng Việt, ngắn gọn, dựa trên JSON được cung cấp.

Quy tắc:
- Không bịa số liệu ngoài JSON.
- Nếu dữ liệu trống, nói rõ chưa có dữ liệu.
- Luôn nêu tên đối tượng đứng đầu và số liệu chính.
- Nếu phù hợp, thêm 1 gợi ý hành động ngắn.
- Không dùng bảng Markdown.

Câu hỏi: ${question}
Intent: ${intent}
Dữ liệu:
${JSON.stringify(compactAdminQueryRows(rows), null, 2)}
`;
}

async function answerAdminDataQuestion({ question, intent, rows }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { provider: 'fallback', answer: formatAdminQueryFallback(question, intent, rows) };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });
    const result = await model.generateContent(buildAdminQueryPrompt({ question, intent, rows }));
    const answer = result.response.text().trim();
    return { provider: 'gemini', answer: answer || formatAdminQueryFallback(question, intent, rows) };
  } catch (error) {
    console.error('[aiInsightService] Gemini admin data answer failed:', error.message);
    return {
      provider: 'fallback',
      warning: 'Gemini không phản hồi, đã dùng câu trả lời dự phòng.',
      answer: formatAdminQueryFallback(question, intent, rows)
    };
  }
}

module.exports = {
  generateRevenueInsight,
  generateScheduleSuggestions,
  classifyAdminQuestion,
  answerAdminDataQuestion
};

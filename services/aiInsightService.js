const { GoogleGenerativeAI } = require('@google/generative-ai');

function getGeminiApiKey() {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

function money(value) {
  return `${Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} \u0111`;
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

function num(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ratio(part, total) {
  const denominator = num(total);
  if (!denominator) return 0;
  return (num(part) / denominator) * 100;
}

function changePercent(current, previous) {
  const prev = num(previous);
  const curr = num(current);
  if (!prev && !curr) return 0;
  if (!prev) return 100;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function formatShortDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function currentAndPrevious(summaryRows = []) {
  const current = summaryRows.find(row => row.PeriodName === 'current') || {};
  const previous = summaryRows.find(row => row.PeriodName === 'previous') || {};
  const normalize = (row) => {
    const ticketRevenue = num(row.TicketRevenue);
    const fnbRevenue = num(row.FnBRevenue);
    const confirmedTickets = num(row.ConfirmedTickets);
    const pendingTickets = num(row.PendingTickets);
    const cancelledTickets = num(row.CancelledTickets);
    const allTickets = confirmedTickets + pendingTickets + cancelledTickets;
    const availableSeats = num(row.AvailableSeats);
    return {
      ticketRevenue,
      fnbRevenue,
      totalRevenue: ticketRevenue + fnbRevenue,
      confirmedTickets,
      pendingTickets,
      cancelledTickets,
      allTickets,
      showtimesCount: num(row.ShowtimesCount),
      availableSeats,
      occupancyRate: ratio(confirmedTickets + pendingTickets, availableSeats),
      cancellationRate: ratio(cancelledTickets, allTickets),
      pendingRate: ratio(pendingTickets, allTickets),
      fnbPerTicket: confirmedTickets ? fnbRevenue / confirmedTickets : 0,
      avgRevenuePerTicket: confirmedTickets ? (ticketRevenue + fnbRevenue) / confirmedTickets : 0
    };
  };

  return { current: normalize(current), previous: normalize(previous) };
}

function compactCinemaPerformance(row = {}) {
  const ticketRevenue = num(row.TicketRevenue);
  const fnbRevenue = num(row.FnBRevenue);
  const tickets = num(row.TicketsSold);
  const pending = num(row.PendingTickets);
  const cancelled = num(row.CancelledTickets);
  return {
    cinemaId: row.CinemaID,
    cinemaName: row.CinemaName || 'Không rõ',
    city: row.City || '',
    tickets,
    pending,
    cancelled,
    ticketRevenue,
    fnbRevenue,
    totalRevenue: ticketRevenue + fnbRevenue,
    occupancyRate: num(row.OccupancyRate),
    cancellationRate: ratio(cancelled, tickets + pending + cancelled),
    fnbPerTicket: tickets ? fnbRevenue / tickets : 0
  };
}

function compactMoviePerformance(row = {}) {
  const ticketRevenue = num(row.TicketRevenue);
  const fnbRevenue = num(row.FnBRevenue);
  const tickets = num(row.TicketsSold);
  return {
    movieId: row.MovieID,
    title: row.Title || 'Không rõ',
    status: row.Status || '',
    tickets,
    cancelled: num(row.CancelledTickets),
    ticketRevenue,
    fnbRevenue,
    totalRevenue: ticketRevenue + fnbRevenue,
    avgTicketValue: num(row.AvgTicketValue),
    fnbPerTicket: tickets ? fnbRevenue / tickets : 0
  };
}

function compactLowShowtime(row = {}) {
  const totalSeats = num(row.TotalSeats);
  const ticketsHeld = num(row.TicketsHeld);
  return {
    showtimeId: row.ShowtimeID,
    movie: row.MovieTitle || 'Không rõ',
    cinema: row.CinemaName || 'Không rõ',
    city: row.City || '',
    room: row.RoomName || '',
    totalSeats,
    ticketsHeld,
    emptySeats: num(row.EmptySeats),
    occupancyRate: num(row.OccupancyRate),
    startTime: row.StartTime || '',
    price: num(row.Price)
  };
}

function compactFnbPerformance(row = {}) {
  return {
    fnbId: row.FnBID,
    name: row.Name || 'Không rõ',
    category: row.Category || '',
    quantitySold: num(row.QuantitySold),
    revenue: num(row.Revenue),
    currentStock: num(row.CurrentStock)
  };
}

function buildRevenueIntelligence(rawData = {}) {
  const snapshot = rawData.intelligence || {};
  const { current, previous } = currentAndPrevious(snapshot.summary || []);
  const revenueGrowth = changePercent(current.totalRevenue, previous.totalRevenue);
  const ticketGrowth = changePercent(current.confirmedTickets, previous.confirmedTickets);
  const fnbShare = ratio(current.fnbRevenue, current.totalRevenue);
  const cinemas = (snapshot.cinemaPerformance || []).map(compactCinemaPerformance);
  const movies = (snapshot.moviePerformance || []).map(compactMoviePerformance);
  const lowShowtimes = (snapshot.lowOccupancyShowtimes || []).map(compactLowShowtime);
  const fnb = (snapshot.fnbPerformance || []).map(compactFnbPerformance);

  const anomalies = [];
  if (current.confirmedTickets > 0 && current.ticketRevenue === 0) {
    anomalies.push({
      severity: 'high',
      title: 'Vé đã bán nhưng doanh thu vé bằng 0',
      evidence: `${current.confirmedTickets} vé confirmed/used nhưng ticket revenue = 0.`,
      action: 'Kiểm tra cách ghi TotalAmount khi tạo vé và khi xác nhận thanh toán.'
    });
  }
  if (current.occupancyRate > 0 && current.occupancyRate < 15) {
    anomalies.push({
      severity: 'medium',
      title: 'Tỷ lệ lấp đầy rất thấp',
      evidence: `Occupancy chỉ ${percent(current.occupancyRate)} trên ${current.showtimesCount} suất trong kỳ.`,
      action: 'Rà lại phim/giờ chiếu thấp điểm, ưu tiên voucher hoặc giảm suất ít khách.'
    });
  }
  if (current.cancellationRate >= 15) {
    anomalies.push({
      severity: 'high',
      title: 'Tỷ lệ hủy vé cao',
      evidence: `${percent(current.cancellationRate)} giao dịch trong kỳ bị hủy.`,
      action: 'Kiểm tra lỗi thanh toán, giữ ghế quá lâu hoặc UX checkout.'
    });
  }
  if (current.pendingRate >= 20) {
    anomalies.push({
      severity: 'medium',
      title: 'Nhiều vé đang pending',
      evidence: `${current.pendingTickets} vé pending, chiếm ${percent(current.pendingRate)} giao dịch trong kỳ.`,
      action: 'Kiểm tra webhook thanh toán và job dọn vé pending hết hạn.'
    });
  }
  movies
    .filter(movie => movie.tickets > 0 && movie.ticketRevenue === 0)
    .slice(0, 3)
    .forEach(movie => anomalies.push({
      severity: 'high',
      title: `Phim "${movie.title}" có vé nhưng revenue vé bằng 0`,
      evidence: `${movie.tickets} vé, ticket revenue = 0, F&B = ${money(movie.fnbRevenue)}.`,
      action: 'Kiểm tra giá suất chiếu, TotalAmount hoặc báo cáo đang bỏ sót doanh thu vé.'
    }));
  lowShowtimes
    .filter(item => item.totalSeats >= 40 && item.occupancyRate < 10)
    .slice(0, 3)
    .forEach(item => anomalies.push({
      severity: 'medium',
      title: `Suất rất vắng tại ${item.cinema}`,
      evidence: `${item.movie} - ${item.room} lúc ${formatShortDate(item.startTime)} chỉ đạt ${percent(item.occupancyRate)}.`,
      action: 'Cân nhắc đẩy khuyến mãi giờ thấp điểm hoặc chuyển phim hot hơn vào phòng này.'
    }));

  const topMovie = movies[0];
  const weakestMovie = movies.slice().reverse().find(movie => movie.tickets === 0 || movie.totalRevenue < current.totalRevenue * 0.03);
  const weakestCinema = cinemas.slice().sort((a, b) => a.occupancyRate - b.occupancyRate || a.totalRevenue - b.totalRevenue)[0];
  const topFnb = fnb[0];
  const actions = [];

  if (topMovie && topMovie.tickets > 0) {
    actions.push(`Ưu tiên thêm/giữ suất cho "${topMovie.title}" ở khung 18:00-22:00 vì đang dẫn đầu với ${topMovie.tickets} vé và ${money(topMovie.totalRevenue)}.`);
  }
  if (weakestMovie) {
    actions.push(`Rà lại lịch của "${weakestMovie.title}": doanh thu thấp (${money(weakestMovie.totalRevenue)}), nên giảm phòng lớn hoặc chuyển sang khung phụ.`);
  }
  if (weakestCinema) {
    actions.push(`Tạo ưu đãi cục bộ cho ${weakestCinema.cinemaName}: occupancy ${percent(weakestCinema.occupancyRate)}, doanh thu ${money(weakestCinema.totalRevenue)}.`);
  }
  if (topFnb && topFnb.revenue > 0) {
    actions.push(`Đẩy combo "${topFnb.name}" vào checkout/khuyến mãi vì đang tạo ${money(topFnb.revenue)} doanh thu F&B.`);
  }
  if (current.fnbPerTicket < 25000 && current.confirmedTickets > 0) {
    actions.push(`Tăng gợi ý combo tại bước bắp nước: F&B/ticket hiện chỉ ${money(current.fnbPerTicket)}.`);
  }
  if (actions.length === 0) {
    actions.push('Tiếp tục theo dõi doanh thu theo rạp/phim và kiểm tra lại khi có thêm dữ liệu giao dịch.');
  }

  let healthScore = 100;
  if (current.occupancyRate < 15) healthScore -= 25;
  else if (current.occupancyRate < 35) healthScore -= 12;
  if (revenueGrowth < -20) healthScore -= 20;
  else if (revenueGrowth < -5) healthScore -= 8;
  if (current.cancellationRate > 15) healthScore -= 18;
  if (current.pendingRate > 25) healthScore -= 12;
  if (fnbShare < 10 && current.confirmedTickets > 0) healthScore -= 8;
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  return {
    period: snapshot.period || rawData.period || 'all',
    periodLabel: snapshot.ranges?.label || rawData.period || 'Kỳ hiện tại',
    previousLabel: snapshot.ranges?.previousLabel || 'Kỳ trước',
    kpi: { ...current, fnbShare, revenueGrowth, ticketGrowth, healthScore },
    previous,
    leaders: {
      topCinema: cinemas[0] || null,
      topMovie: topMovie || null,
      topFnb: topFnb || null
    },
    weakSpots: {
      weakestCinema: weakestCinema || null,
      weakestMovie: weakestMovie || null,
      lowShowtimes: lowShowtimes.slice(0, 5)
    },
    anomalies: anomalies.slice(0, 8),
    recommendedActions: actions.slice(0, 6),
    cinemaPerformance: cinemas.slice(0, 8),
    moviePerformance: movies.slice(0, 10),
    fnbPerformance: fnb.slice(0, 8)
  };
}

function buildFallbackInsight(data = {}) {
  const intelligence = buildRevenueIntelligence(data);
  const kpi = intelligence.kpi;
  const leaders = intelligence.leaders;
  const weak = intelligence.weakSpots;
  const trendText = kpi.revenueGrowth >= 0
    ? `t\u0103ng ${percent(kpi.revenueGrowth)} so v\u1edbi ${intelligence.previousLabel}`
    : `gi\u1ea3m ${percent(Math.abs(kpi.revenueGrowth))} so v\u1edbi ${intelligence.previousLabel}`;

  const highlights = [];
  if (leaders.topCinema) {
    highlights.push(`${leaders.topCinema.cinemaName} d\u1eabn \u0111\u1ea7u doanh thu v\u1edbi ${money(leaders.topCinema.totalRevenue)} v\u00e0 ${leaders.topCinema.tickets} v\u00e9.`);
  }
  if (leaders.topMovie) {
    highlights.push(`Phim "${leaders.topMovie.title}" \u0111\u00f3ng g\u00f3p t\u1ed1t nh\u1ea5t: ${leaders.topMovie.tickets} v\u00e9, ${money(leaders.topMovie.totalRevenue)}.`);
  }
  if (leaders.topFnb) {
    highlights.push(`F&B n\u1ed5i b\u1eadt l\u00e0 "${leaders.topFnb.name}" v\u1edbi ${leaders.topFnb.quantitySold} ph\u1ea7n, doanh thu ${money(leaders.topFnb.revenue)}.`);
  }

  const risks = intelligence.anomalies.length
    ? intelligence.anomalies.map(item => `${item.title}: ${item.evidence}`)
    : ['Ch\u01b0a ph\u00e1t hi\u1ec7n b\u1ea5t th\u01b0\u1eddng l\u1edbn t\u1eeb d\u1eef li\u1ec7u k\u1ef3 hi\u1ec7n t\u1ea1i.'];
  const lowShowtime = weak.lowShowtimes[0];

  return [
    'T\u1ed5ng quan',
    `- ${intelligence.periodLabel}: doanh thu kinh doanh \u0111\u1ea1t ${money(kpi.totalRevenue)} (${money(kpi.ticketRevenue)} v\u00e9 + ${money(kpi.fnbRevenue)} F&B), ${trendText}.`,
    `- B\u00e1n ${kpi.confirmedTickets} v\u00e9, occupancy ${percent(kpi.occupancyRate)}, F&B/ticket ${money(kpi.fnbPerTicket)}, \u0111i\u1ec3m s\u1ee9c kh\u1ecfe ${kpi.healthScore}/100.`,
    '',
    '\u0110i\u1ec3m n\u1ed5i b\u1eadt',
    highlights.length ? highlights.map(item => `- ${item}`).join('\\n') : '- Ch\u01b0a \u0111\u1ee7 d\u1eef li\u1ec7u \u0111\u1ec3 x\u00e1c \u0111\u1ecbnh \u0111i\u1ec3m n\u1ed5i b\u1eadt.',
    '',
    'V\u1ea5n \u0111\u1ec1 c\u1ea7n ch\u00fa \u00fd',
    risks.slice(0, 4).map(item => `- ${item}`).join('\\n'),
    lowShowtime ? `- Su\u1ea5t v\u1eafng nh\u1ea5t: ${lowShowtime.movie} t\u1ea1i ${lowShowtime.cinema} (${percent(lowShowtime.occupancyRate)}, c\u00f2n ${lowShowtime.emptySeats} gh\u1ebf).` : '',
    '',
    '\u0110\u1ec1 xu\u1ea5t h\u00e0nh \u0111\u1ed9ng',
    intelligence.recommendedActions.slice(0, 4).map(item => `- ${item}`).join('\\n')
  ].filter(Boolean).join('\\n');
}
function buildRevenuePrompt(data) {
  return `
B\u1ea1n l\u00e0 AI Business Analyst cho h\u1ec7 th\u1ed1ng r\u1ea1p phim D-CINEMA.
D\u1eef li\u1ec7u JSON \u0111\u00e3 c\u00f3 s\u1ed1 li\u1ec7u th\u00f4 v\u00e0 analysisContext do backend t\u00ednh s\u1eb5n.

Y\u00eau c\u1ea7u b\u1eaft bu\u1ed9c:
- Kh\u00f4ng b\u1ecba s\u1ed1 li\u1ec7u ngo\u00e0i JSON.
- \u01afu ti\u00ean d\u00f9ng analysisContext.kpi, anomalies, weakSpots, leaders, recommendedActions.
- N\u00f3i nh\u01b0 tr\u1ee3 l\u00fd v\u1eadn h\u00e0nh: n\u00eau nguy\u00ean nh\u00e2n c\u00f3 kh\u1ea3 n\u0103ng v\u00e0 h\u00e0nh \u0111\u1ed9ng c\u1ee5 th\u1ec3.
- N\u1ebfu ph\u00e1t hi\u1ec7n v\u00e9 c\u00f3 b\u00e1n nh\u01b0ng doanh thu = 0, ph\u1ea3i x\u1ebfp v\u00e0o v\u1ea5n \u0111\u1ec1 d\u1eef li\u1ec7u.
- Kh\u00f4ng d\u00f9ng b\u1ea3ng Markdown.
- Tr\u1ea3 \u0111\u00fang 4 ph\u1ea7n: T\u1ed5ng quan, \u0110i\u1ec3m n\u1ed5i b\u1eadt, V\u1ea5n \u0111\u1ec1 c\u1ea7n ch\u00fa \u00fd, \u0110\u1ec1 xu\u1ea5t h\u00e0nh \u0111\u1ed9ng.
- M\u1ed7i ph\u1ea7n 1-3 g\u1ea1ch \u0111\u1ea7u d\u00f2ng, ng\u1eafn nh\u01b0ng c\u00f3 insight.

D\u1eef li\u1ec7u:
${JSON.stringify(data, null, 2)}
`;
}
async function generateRevenueInsight(rawData = {}) {
  const analysisContext = buildRevenueIntelligence(rawData);
  const data = {
    generatedAt: new Date().toISOString(),
    period: rawData.period || 'all',
    cinemaId: rawData.cinemaId || null,
    analysisContext,
    stats: rawData.stats || {},
    topMovies: (rawData.topMovies || []).slice(0, 8).map(compactMovie),
    recentTransactions: (rawData.recentTxns || []).slice(0, 12).map(compactTransaction),
    monthlyRevenue: (rawData.monthlyRevenue || []).slice(-12),
    revenueSummary: rawData.revenueStats ? rawData.revenueStats.summary : null
  };

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { provider: 'fallback', insight: buildFallbackInsight(rawData), metrics: analysisContext };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });
    const result = await model.generateContent(buildRevenuePrompt(data));
    const insight = result.response.text().trim();
    return { provider: 'gemini', insight: insight || buildFallbackInsight(rawData), metrics: analysisContext };
  } catch (error) {
    console.error('[aiInsightService] Gemini revenue insight failed:', error.message);
    return {
      provider: 'fallback',
      warning: 'Gemini không phản hồi, đã dùng phân tích dự phòng.',
      insight: buildFallbackInsight(rawData),
      metrics: analysisContext
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

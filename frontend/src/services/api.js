// Central API service — mirrors all fetch calls from public/app.js and page-specific JS files.
// All endpoints proxy through Vite → http://localhost:9999

function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
}

function authHeaders() {
  const token = getToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return data;
}

// ─── Auth ────────────────────────────────────────────
export const authApi = {
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => request('/api/auth/me'),
  googleLogin: (credential) => request('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyOTP: (body) => request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify(body) }),
  resetPassword: (body) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
};

// ─── Movies ──────────────────────────────────────────
export const movieApi = {
  getAll: () => request('/api/movies'),
  getNowShowing: () => request('/api/movies/now-showing'),
  getComingSoon: () => request('/api/movies/coming-soon'),
  getById: (id) => request(`/api/movies/${id}`),
  getShowtimes: (movieId) => request(`/api/movies/${movieId}/showtimes`),
};

// ─── Bookings ─────────────────────────────────────────
export const bookingApi = {
  create: (body) => request('/api/bookings', { method: 'POST', body: JSON.stringify(body) }),
  getHistory: () => request('/api/bookings/history'),
  getById: (id) => request(`/api/bookings/${id}`),
  cancel: (id) => request(`/api/bookings/${id}/cancel`, { method: 'POST' }),
  getShowtimeSeats: (showtimeId) => request(`/api/bookings/showtimes/${showtimeId}/seats`),
  getConcessions: () => request('/api/bookings/concessions'),
  applyVoucher: (body) => request('/api/bookings/apply-voucher', { method: 'POST', body: JSON.stringify(body) }),
  initiatePayment: (body) => request('/api/bookings/payment/initiate', { method: 'POST', body: JSON.stringify(body) }),
  getTicketDetails: (ticketId) => request(`/api/bookings/ticket/${ticketId}`),
};

// ─── Users ───────────────────────────────────────────
export const userApi = {
  getProfile: () => request('/api/users/profile'),
  updateProfile: (body) => request('/api/users/profile', { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (body) => request('/api/users/change-password', { method: 'POST', body: JSON.stringify(body) }),
  uploadAvatar: (formData) =>
    fetch('/api/users/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then((r) => r.json()),
  getBookingHistory: () => request('/api/users/bookings'),
  requestRefund: (bookingId, body) =>
    request(`/api/users/bookings/${bookingId}/refund`, { method: 'POST', body: JSON.stringify(body) }),
};

// ─── News ────────────────────────────────────────────
export const newsApi = {
  getAll: (params = '') => request(`/api/news${params}`),
  getById: (id) => request(`/api/news/${id}`),
};

// ─── Promotions ──────────────────────────────────────
export const promotionApi = {
  getAll: () => request('/api/admin/promotions'),
  getById: (id) => request(`/api/admin/promotions/${id}`),
};

// ─── Vouchers ─────────────────────────────────────────
export const voucherApi = {
  getAll: () => request('/api/admin/vouchers'),
  create: (body) => request('/api/admin/vouchers', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/api/admin/vouchers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => request(`/api/admin/vouchers/${id}`, { method: 'DELETE' }),
};

// ─── Admin ───────────────────────────────────────────
export const adminApi = {
  getDashboard: () => request('/api/admin/dashboard'),
  getMovies: () => request('/api/admin/movies'),
  createMovie: (body) => request('/api/admin/movies', { method: 'POST', body: JSON.stringify(body) }),
  updateMovie: (id, body) => request(`/api/admin/movies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMovie: (id) => request(`/api/admin/movies/${id}`, { method: 'DELETE' }),
  getCinemas: () => request('/api/admin/cinemas'),
  getShowtimes: () => request('/api/admin/showtimes'),
  getUsers: () => request('/api/admin/users'),
  getRefundRequests: () => request('/api/admin/refunds'),
  processRefund: (id, body) => request(`/api/admin/refunds/${id}`, { method: 'POST', body: JSON.stringify(body) }),
  getNews: () => request('/api/admin/news'),
  createNews: (body) => request('/api/admin/news', { method: 'POST', body: JSON.stringify(body) }),
  updateNews: (id, body) => request(`/api/admin/news/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteNews: (id) => request(`/api/admin/news/${id}`, { method: 'DELETE' }),
  getRevenueStats: () => request('/api/admin/stats/revenue'),
};

// ─── Ticket Verify ────────────────────────────────────
export const ticketApi = {
  verify: (code) => request(`/api/staff/verify-ticket?code=${encodeURIComponent(code)}`),
};

// ─── Chat ─────────────────────────────────────────────
export const chatApi = {
  sendMessage: (body) => request('/api/chat', { method: 'POST', body: JSON.stringify(body) }),
};

// ─── Cinemas (public) ─────────────────────────────────
export const cinemaApi = {
  getAll: () => request('/api/movies/cinemas'),
};

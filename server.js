// ============================================================
//  server.js  –  Entry point | CinemaVerse Backend
//  Port: 9999  |  Socket.IO ready for real-time seat locking
// ============================================================
const express = require('express');
require('dotenv').config();
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { getPool } = require('./config/db');

// ─── App & Server ────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

const PORT = process.env.PORT || 9999;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());                            // Cho phép cross-origin requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files từ thư mục public/
app.use(express.static(path.join(__dirname, 'public')));
// Serve thư mục uploads để lấy avatar
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── API Routes ───────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const movieRoutes = require('./routes/movieRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/auth', authRoutes);     // Đăng ký, Đăng nhập
app.use('/api/users', userRoutes);    // Thông tin người dùng (Profile)
app.use('/api/movies', movieRoutes);    // Thông tin phim & lịch chiếu
app.use('/api/bookings', bookingRoutes);  // Đặt vé, lịch sử, voucher
app.use('/api/admin', adminRoutes);    // Quản lý, thống kê (chỉ Super Admin)

// ─── Health-check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), port: PORT });
});

// ─── 404 Handler (API) ───────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} không tồn tại.` });
});

// ─── Explicit page routes ────────────────────────────────────
app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});
app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});
app.get('/booking', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'booking.html'));
});

// ─── SPA Fallback — trả về index.html cho mọi route khác ─────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Socket.IO — Real-time seat locking ───────────────────────
const socketManager = require('./sockets/socketManager');
socketManager(io);

// ─── Start Server ─────────────────────────────────────────────
server.listen(PORT, async () => {
  console.log('');
  console.log('  ██████╗██╗███╗   ██╗███████╗███╗   ███╗ █████╗ ');
  console.log(' ██╔════╝██║████╗  ██║██╔════╝████╗ ████║██╔══██╗');
  console.log(' ██║     ██║██╔██╗ ██║█████╗  ██╔████╔██║███████║');
  console.log(' ██║     ██║██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══██║');
  console.log(' ╚██████╗██║██║ ╚████║███████╗██║ ╚═╝ ██║██║  ██║');
  console.log('  ╚═════╝╚═╝╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝');
  console.log('');
  console.log(`  🎬  CinemaVerse Server đang chạy tại http://localhost:${PORT}`);
  console.log(`  🔌  Socket.IO sẵn sàng cho real-time seat locking`);
  console.log('');

  // Khởi tạo kết nối DB ngay khi server start
  try {
    await getPool();
  } catch (err) {
    console.error('  ⚠️  Không thể kết nối DB. Kiểm tra lại config/db.js');
  }
});

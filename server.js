// ============================================================
//  server.js  –  Entry point | CinemaVerse Backend
//  Port: 9999  |  Socket.IO ready for real-time seat locking
// ============================================================
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

// ─── App & Server ────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 9999;

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files từ thư mục public/
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───────────────────────────────────────────────
const movieRoutes   = require('./routes/movieRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

app.use('/api/movies',   movieRoutes);
app.use('/api/bookings', bookingRoutes);

// Health-check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), port: PORT });
});

// SPA fallback — trả về index.html cho mọi route không khớp (Express 5)
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Socket.IO — Real-time seat locking ───────────────────────
// lockedSeats: { [showtimeId]: Set<seatId> }
const lockedSeats = {};

io.on('connection', (socket) => {
  console.log(`[Socket] 🟢 Client connected: ${socket.id}`);

  // Client chọn ghế → lock tạm thời
  socket.on('lock-seat', ({ showtimeId, seatId }) => {
    if (!lockedSeats[showtimeId]) lockedSeats[showtimeId] = new Set();
    if (lockedSeats[showtimeId].has(seatId)) {
      socket.emit('seat-lock-failed', { seatId, reason: 'Ghế đang được người khác chọn' });
      return;
    }
    lockedSeats[showtimeId].add(seatId);
    socket.join(`showtime-${showtimeId}`);
    // Thông báo tới tất cả client trong cùng suất chiếu
    io.to(`showtime-${showtimeId}`).emit('seat-locked', { seatId, lockedBy: socket.id });
    console.log(`[Socket] 🔒 Locked seat ${seatId} | showtime ${showtimeId}`);
  });

  // Client bỏ chọn ghế → unlock
  socket.on('unlock-seat', ({ showtimeId, seatId }) => {
    lockedSeats[showtimeId]?.delete(seatId);
    io.to(`showtime-${showtimeId}`).emit('seat-unlocked', { seatId });
    console.log(`[Socket] 🔓 Unlocked seat ${seatId} | showtime ${showtimeId}`);
  });

  // Client disconnect → tự động unlock tất cả ghế đang lock
  socket.on('disconnect', () => {
    console.log(`[Socket] 🔴 Client disconnected: ${socket.id}`);
    // TODO: track socket→seats mapping để unlock đúng ghế khi disconnect
  });
});

// ─── Start Server ─────────────────────────────────────────────
server.listen(PORT, () => {
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
});

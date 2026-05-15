// controllers/bookingController.js
// const { getPool, sql } = require('../config/db');

// GET /api/bookings/showtimes/:movieId
exports.getShowtimes = async (req, res) => {
  try {
    // TODO: query DB — SELECT * FROM Showtimes WHERE MovieId = @movieId
    const sample = [
      { id: 1, movieId: req.params.movieId, date: '2026-05-15', time: '10:00', hall: 'Hall A', available: 80 },
      { id: 2, movieId: req.params.movieId, date: '2026-05-15', time: '13:30', hall: 'Hall B', available: 60 },
      { id: 3, movieId: req.params.movieId, date: '2026-05-15', time: '19:00', hall: 'IMAX 1', available: 45 },
    ];
    res.json({ success: true, data: sample });
  } catch (err) {
    console.error('[bookingController] getShowtimes:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/bookings/seats/:showtimeId
exports.getSeats = async (req, res) => {
  try {
    // TODO: query DB — SELECT * FROM Seats WHERE ShowtimeId = @showtimeId
    // Trạng thái ghế: 'available' | 'booked' | 'locked' (locked = đang chọn real-time qua socket.io)
    const rows = 8, cols = 10;
    const seats = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        seats.push({
          id: `${String.fromCharCode(65 + r)}${c + 1}`,
          row: String.fromCharCode(65 + r),
          col: c + 1,
          status: Math.random() < 0.25 ? 'booked' : 'available',
          type: r < 2 ? 'vip' : 'standard',
          price: r < 2 ? 120000 : 90000,
        });
      }
    }
    res.json({ success: true, data: seats });
  } catch (err) {
    console.error('[bookingController] getSeats:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/bookings
exports.createBooking = async (req, res) => {
  try {
    const { userId, showtimeId, seats, totalPrice, paymentMethod } = req.body;
    if (!showtimeId || !seats?.length) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đặt vé' });
    }
    // TODO: INSERT INTO Bookings ...
    const booking = {
      id: Date.now(),
      userId,
      showtimeId,
      seats,
      totalPrice,
      paymentMethod,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    console.log('[Booking] Tạo đơn:', booking);
    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    console.error('[bookingController] createBooking:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

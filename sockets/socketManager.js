const sessionConnections = new Map(); // key: bookingSessionId, value: Set of socketId (active connections)
const disconnectTimeouts = new Map(); // key: bookingSessionId, value: timeoutId

let _io = null; // Lưu io instance để controller có thể emit về client
const BookingModel = require('../models/bookingModel');

const SEAT_TIMEOUT = 5; // 5 minutes

module.exports = (io) => {
    _io = io; // Lưu reference để dùng ở ngoài module
    io.on('connection', (socket) => {
        const bookingSessionId = socket.handshake.query.bookingSessionId || socket.id;
        console.log(`[Socket] 🟢 Client connected: ${socket.id} | Session: ${bookingSessionId}`);

        // Đăng ký connection vào session
        if (!sessionConnections.has(bookingSessionId)) {
            sessionConnections.set(bookingSessionId, new Set());
        }
        sessionConnections.get(bookingSessionId).add(socket.id);

        // Hủy dọn dẹp nếu người dùng reconnect lại trong thời gian grace period
        if (disconnectTimeouts.has(bookingSessionId)) {
            clearTimeout(disconnectTimeouts.get(bookingSessionId));
            disconnectTimeouts.delete(bookingSessionId);
            console.log(`[Socket] 🔄 Hủy dọn dẹp tự động cho session reconnected: ${bookingSessionId}`);
        }

        // 1. Join Showtime Room
        socket.on('joinShowtime', (showtimeId) => {
            const room = `room_showtime_${showtimeId}`;
            socket.join(room);
            console.log(`[Socket] Client ${socket.id} joined ${room}`);
        });

        // 1b. Join Payment Room
        socket.on('joinPaymentRoom', async (ticketIds) => {
            if (!Array.isArray(ticketIds) || ticketIds.length === 0) return;
            const sortedIds = [...ticketIds].map(Number).sort((a, b) => a - b);
            const room = `payment_${sortedIds.join('_')}`;
            socket.join(room);
            console.log(`[Socket] 💳 Client ${socket.id} joined payment room: ${room}`);
            socket.emit('paymentRoomJoined', { room, ticketIds: sortedIds });

            try {
                const tickets = await BookingModel.checkBookingStatus(sortedIds);
                if (tickets.length > 0 && tickets.every(t => t.Status === 'confirmed')) {
                    socket.emit('payment_confirmed', {
                        ticketIds: sortedIds,
                        confirmedAt: new Date().toISOString(),
                        source: 'socket-rejoin-auto'
                    });
                }
            } catch (err) {
                console.error('[Socket joinPaymentRoom check status error]:', err.message);
            }
        });

        // 1c. Reclaim Seats — Client lấy lại quyền sở hữu ghế khi load lại trang seats.html
        socket.on('reclaimSeats', async ({ showtimeId, seatIds }) => {
            if (!Array.isArray(seatIds) || !bookingSessionId) return;
            try {
                await BookingModel.reclaimSeatsDB(showtimeId, seatIds, bookingSessionId, socket.id);
                console.log(`[Socket] 🔄 Đã khôi phục quyền sở hữu ghế cho socket ${socket.id} (Session: ${bookingSessionId})`);
            } catch (err) {
                console.error('[Socket reclaimSeats error]', err);
            }
        });

        // 2. Hold Seat
        socket.on('holdSeat', async ({ showtimeId, seatId }) => {
            const room = `room_showtime_${showtimeId}`;
            try {
                const success = await BookingModel.holdSeatDB(showtimeId, seatId, bookingSessionId, socket.id, SEAT_TIMEOUT);
                if (!success) {
                    socket.emit('seatHoldFailed', { seatId, message: 'Ghế đã có người chọn' });
                    return;
                }
                
                io.to(room).emit('seatStatusUpdated', { showtimeId, seatId, status: 'Đang chọn' });
                console.log(`[Socket] 🔒 Khóa ghế ${seatId} | showtime ${showtimeId} bởi session ${bookingSessionId}`);
                
                // Đặt timeout dọn dẹp (fallback nếu user không thao tác)
                setTimeout(async () => {
                    try {
                        const deleted = await BookingModel.releaseSeatDB(showtimeId, seatId, bookingSessionId);
                        if (deleted) {
                            io.to(room).emit('seatStatusUpdated', { showtimeId, seatId, status: 'Trống' });
                            console.log(`[Socket] ⏰ Hết hạn 5 phút: Tự động giải phóng ghế ${seatId} | showtime ${showtimeId}`);
                        }
                    } catch (e) {
                        console.error('[Socket timeout release error]', e);
                    }
                }, SEAT_TIMEOUT * 60 * 1000);

            } catch (err) {
                console.error('[Socket holdSeat error]', err);
            }
        });

        // 3. Release Seat
        socket.on('releaseSeat', async ({ showtimeId, seatId }) => {
            const room = `room_showtime_${showtimeId}`;
            try {
                const deleted = await BookingModel.releaseSeatDB(showtimeId, seatId, bookingSessionId);
                if (deleted) {
                    io.to(room).emit('seatStatusUpdated', { showtimeId, seatId, status: 'Trống' });
                    console.log(`[Socket] 🔓 Hủy khóa ghế ${seatId} | showtime ${showtimeId} bởi session ${bookingSessionId}`);
                }
            } catch (err) {
                console.error('[Socket releaseSeat error]', err);
            }
        });

        // 4. Disconnect (Auto-release all held seats of the user after a grace period of 8 seconds)
        socket.on('disconnect', () => {
            console.log(`[Socket] 🔴 Client disconnected: ${socket.id} (Session: ${bookingSessionId})`);
            
            if (bookingSessionId) {
                const activeConns = sessionConnections.get(bookingSessionId);
                if (activeConns) {
                    activeConns.delete(socket.id);
                    if (activeConns.size === 0) {
                        sessionConnections.delete(bookingSessionId);
                    }
                }

                const hasActive = sessionConnections.has(bookingSessionId) && sessionConnections.get(bookingSessionId).size > 0;
                if (!hasActive) {
                    if (disconnectTimeouts.has(bookingSessionId)) {
                        clearTimeout(disconnectTimeouts.get(bookingSessionId));
                    }

                    const timeoutId = setTimeout(async () => {
                        const stillHasActive = sessionConnections.has(bookingSessionId) && sessionConnections.get(bookingSessionId).size > 0;
                        if (!stillHasActive) {
                            try {
                                const releasedSeats = await BookingModel.releaseAllSeatsBySession(bookingSessionId);
                                if (releasedSeats && releasedSeats.length > 0) {
                                    releasedSeats.forEach(s => {
                                        io.to(`room_showtime_${s.ShowtimeID}`).emit('seatStatusUpdated', {
                                            showtimeId: s.ShowtimeID,
                                            seatId: String(s.SeatID),
                                            status: 'Trống'
                                        });
                                    });
                                    console.log(`[Socket] 🧹 Grace period hết hạn: Giải phóng ${releasedSeats.length} ghế cho Session: ${bookingSessionId}`);
                                }
                            } catch (e) {
                                console.error('[Socket disconnect grace period error]', e);
                            }
                            disconnectTimeouts.delete(bookingSessionId);
                        }
                    }, 8000); // 8 giây grace period

                    disconnectTimeouts.set(bookingSessionId, timeoutId);
                } else {
                    console.log(`[Socket] Session ${bookingSessionId} vẫn còn kết nối hoạt động. Bỏ qua dọn dẹp.`);
                }
            }
        });
    });
};

module.exports.getLockedSeats = () => {
    // Được thay thế bằng BookingModel.getLockedSeatsDB trong controller
    return []; 
};

module.exports.emitPaymentConfirmed = (ticketIds, payload = {}) => {
    if (!_io) {
        console.warn('[Socket] emitPaymentConfirmed called but io is not initialized yet.');
        return;
    }
    const sortedIds = [...ticketIds].map(Number).sort((a, b) => a - b);
    const room = `payment_${sortedIds.join('_')}`;
    _io.to(room).emit('payment_confirmed', {
        ticketIds: sortedIds,
        confirmedAt: new Date().toISOString(),
        ...payload
    });
    console.log(`[Socket] 🎉 Emitted payment_confirmed to room: ${room}`);
};

const lockedSeats = new Map(); // key: `${showtimeId}_${seatId}`, value: { socketId, timerId, timestamp }
const socketToSeats = new Map(); // key: socketId, value: Set of `${showtimeId}_${seatId}`

// ─── Payment Room: map ticketId → Set of socketIds đang chờ thanh toán ───
let _io = null; // Lưu io instance để controller có thể emit về client

const SEAT_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

module.exports = (io) => {
    _io = io; // Lưu reference để dùng ở ngoài module
    io.on('connection', (socket) => {
        console.log(`[Socket] 🟢 Client connected: ${socket.id}`);

        // Initialize user's locked seats tracking
        socketToSeats.set(socket.id, new Set());

        // 1. Join Showtime Room
        socket.on('joinShowtime', (showtimeId) => {
            const room = `room_showtime_${showtimeId}`;
            socket.join(room);
            console.log(`[Socket] Client ${socket.id} joined ${room}`);
        });

        // 1b. Join Payment Room — client gọi sau khi tạo vé thành công, truyền ticketIds
        // Room name: payment_TICKETID1_TICKETID2_... (sắp xếp tăng dần để nhất quán)
        socket.on('joinPaymentRoom', async (ticketIds) => {
            if (!Array.isArray(ticketIds) || ticketIds.length === 0) return;
            const sortedIds = [...ticketIds].map(Number).sort((a, b) => a - b);
            const room = `payment_${sortedIds.join('_')}`;
            socket.join(room);
            console.log(`[Socket] 💳 Client ${socket.id} joined payment room: ${room}`);
            // Gửi ACK để client biết đã join thành công
            socket.emit('paymentRoomJoined', { room, ticketIds: sortedIds });

            // ⭐ Nếu vé đã được xác nhận thành công từ trước trong DB, emit payment_confirmed ngay lập tức
            try {
                const BookingModel = require('../models/bookingModel');
                const tickets = await BookingModel.checkBookingStatus(sortedIds);
                if (tickets.length > 0 && tickets.every(t => t.Status === 'confirmed')) {
                    console.log(`[Socket] Ticket room ${room} joined but already confirmed. Sending immediate confirmation.`);
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

        // 2. Hold Seat
        socket.on('holdSeat', ({ showtimeId, seatId }) => {
            const seatKey = `${showtimeId}_${seatId}`;
            const room = `room_showtime_${showtimeId}`;

            // Check if seat is already locked
            if (lockedSeats.has(seatKey)) {
                socket.emit('seatHoldFailed', { seatId, message: 'Ghế đã có người chọn' });
                return;
            }

            // Auto-release logic after SEAT_TIMEOUT
            const timerId = setTimeout(() => {
                if (lockedSeats.has(seatKey)) {
                    lockedSeats.delete(seatKey);
                    const userSeats = socketToSeats.get(socket.id);
                    if (userSeats) userSeats.delete(seatKey);

                    io.to(room).emit('seatStatusUpdated', {
                        showtimeId,
                        seatId,
                        status: 'Trống'
                    });
                    console.log(`[Socket] ⏰ Auto-released seat ${seatId} | showtime ${showtimeId}`);
                }
            }, SEAT_TIMEOUT);

            // Save to maps
            lockedSeats.set(seatKey, { socketId: socket.id, timerId, timestamp: Date.now() });
            socketToSeats.get(socket.id).add(seatKey);

            // Broadcast to room
            io.to(room).emit('seatStatusUpdated', {
                showtimeId,
                seatId,
                status: 'Đang chọn'
            });
            console.log(`[Socket] 🔒 Locked seat ${seatId} | showtime ${showtimeId} by ${socket.id}`);
        });

        // 3. Release Seat
        socket.on('releaseSeat', ({ showtimeId, seatId }) => {
            const seatKey = `${showtimeId}_${seatId}`;
            const room = `room_showtime_${showtimeId}`;

            const lockInfo = lockedSeats.get(seatKey);
            // Only the socket that locked it can release it manually
            if (lockInfo && lockInfo.socketId === socket.id) {
                clearTimeout(lockInfo.timerId);
                lockedSeats.delete(seatKey);

                const userSeats = socketToSeats.get(socket.id);
                if (userSeats) userSeats.delete(seatKey);

                io.to(room).emit('seatStatusUpdated', {
                    showtimeId,
                    seatId,
                    status: 'Trống'
                });
                console.log(`[Socket] 🔓 Unlocked seat ${seatId} | showtime ${showtimeId} by ${socket.id}`);
            }
        });

        // 4. Disconnect (Auto-release all held seats of the user)
        socket.on('disconnect', () => {
            console.log(`[Socket] 🔴 Client disconnected: ${socket.id}`);
            const userSeats = socketToSeats.get(socket.id);

            if (userSeats) {
                for (const seatKey of userSeats) {
                    const lockInfo = lockedSeats.get(seatKey);
                    if (lockInfo) {
                        clearTimeout(lockInfo.timerId);
                        lockedSeats.delete(seatKey);

                        const [showtimeId, seatId] = seatKey.split('_');
                        const room = `room_showtime_${showtimeId}`;

                        io.to(room).emit('seatStatusUpdated', {
                            showtimeId,
                            seatId,
                            status: 'Trống'
                        });
                        console.log(`[Socket] 🧹 Cleaned up seat ${seatId} | showtime ${showtimeId} due to disconnect`);
                    }
                }
                socketToSeats.delete(socket.id); // Remove tracking for this socket
            }
        });
    });
};

module.exports.getLockedSeats = (showtimeId) => {
    const seats = [];
    for (const key of lockedSeats.keys()) {
        if (key.startsWith(`${showtimeId}_`)) {
            seats.push(key.split('_')[1]);
        }
    }
    return seats;
};

/**
 * Emit sự kiện xác nhận thanh toán thành công về đúng payment room.
 * Được gọi từ bookingController sau khi webhook / polling xác nhận tiền đã về.
 *
 * @param {number[]} ticketIds - Danh sách TicketID đã xác nhận
 * @param {object}  payload    - Thông tin bổ sung gửi về client
 */
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

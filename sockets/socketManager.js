const lockedSeats = new Map(); // key: `${showtimeId}_${seatId}`, value: { socketId, bookingSessionId, timerId, timestamp }
const sessionToSeats = new Map(); // key: bookingSessionId, value: Set of `${showtimeId}_${seatId}`
const sessionConnections = new Map(); // key: bookingSessionId, value: Set of socketId (active connections)
const disconnectTimeouts = new Map(); // key: bookingSessionId, value: timeoutId

// ─── Payment Room: map ticketId → Set of socketIds đang chờ thanh toán ───
let _io = null; // Lưu io instance để controller có thể emit về client

const SEAT_TIMEOUT = 5 * 60 * 1000; // 5 minutes (300 seconds) in milliseconds

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

        // Khởi tạo theo dõi ghế đã khóa cho session nếu chưa có
        if (!sessionToSeats.has(bookingSessionId)) {
            sessionToSeats.set(bookingSessionId, new Set());
        }

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

        // 1c. Reclaim Seats — Client lấy lại quyền sở hữu ghế khi load lại trang seats.html
        socket.on('reclaimSeats', ({ showtimeId, seatIds }) => {
            if (!Array.isArray(seatIds) || !bookingSessionId) return;
            seatIds.forEach(seatId => {
                const seatKey = `${showtimeId}_${seatId}`;
                const lockInfo = lockedSeats.get(seatKey);
                if (lockInfo && lockInfo.bookingSessionId === bookingSessionId) {
                    // Cập nhật socketId mới sang kết nối hiện tại để duy trì quyền giữ ghế
                    lockInfo.socketId = socket.id;
                    sessionToSeats.get(bookingSessionId).add(seatKey);
                    console.log(`[Socket] 🔄 Đã khôi phục quyền sở hữu ghế ${seatId} cho socket ${socket.id} (Session: ${bookingSessionId})`);
                }
            });
        });

        // 2. Hold Seat
        socket.on('holdSeat', ({ showtimeId, seatId }) => {
            const seatKey = `${showtimeId}_${seatId}`;
            const room = `room_showtime_${showtimeId}`;

            // Check if seat is already locked by someone else
            const existingLock = lockedSeats.get(seatKey);
            if (existingLock && existingLock.bookingSessionId !== bookingSessionId) {
                socket.emit('seatHoldFailed', { seatId, message: 'Ghế đã có người chọn' });
                return;
            }

            // Hủy timer cũ nếu có
            if (existingLock && existingLock.timerId) {
                clearTimeout(existingLock.timerId);
            }

            // Auto-release logic after SEAT_TIMEOUT (5 phút)
            const timerId = setTimeout(() => {
                if (lockedSeats.has(seatKey)) {
                    lockedSeats.delete(seatKey);
                    const userSeats = sessionToSeats.get(bookingSessionId);
                    if (userSeats) userSeats.delete(seatKey);

                    io.to(room).emit('seatStatusUpdated', {
                        showtimeId,
                        seatId,
                        status: 'Trống'
                    });
                    console.log(`[Socket] ⏰ Hết hạn 5 phút: Tự động giải phóng ghế ${seatId} | showtime ${showtimeId}`);
                }
            }, SEAT_TIMEOUT);

            // Save to maps
            lockedSeats.set(seatKey, { socketId: socket.id, bookingSessionId, timerId, timestamp: Date.now() });
            sessionToSeats.get(bookingSessionId).add(seatKey);

            // Broadcast to room
            io.to(room).emit('seatStatusUpdated', {
                showtimeId,
                seatId,
                status: 'Đang chọn'
            });
            console.log(`[Socket] 🔒 Khóa ghế ${seatId} | showtime ${showtimeId} bởi session ${bookingSessionId}`);
        });

        // 3. Release Seat
        socket.on('releaseSeat', ({ showtimeId, seatId }) => {
            const seatKey = `${showtimeId}_${seatId}`;
            const room = `room_showtime_${showtimeId}`;

            const lockInfo = lockedSeats.get(seatKey);
            // Chỉ chủ sở hữu session mới được phép hủy
            if (lockInfo && lockInfo.bookingSessionId === bookingSessionId) {
                clearTimeout(lockInfo.timerId);
                lockedSeats.delete(seatKey);

                const userSeats = sessionToSeats.get(bookingSessionId);
                if (userSeats) userSeats.delete(seatKey);

                io.to(room).emit('seatStatusUpdated', {
                    showtimeId,
                    seatId,
                    status: 'Trống'
                });
                console.log(`[Socket] 🔓 Hủy khóa ghế ${seatId} | showtime ${showtimeId} bởi session ${bookingSessionId}`);
            }
        });

        // 4. Disconnect (Auto-release all held seats of the user after a grace period of 8 seconds)
        socket.on('disconnect', () => {
            console.log(`[Socket] 🔴 Client disconnected: ${socket.id} (Session: ${bookingSessionId})`);
            
            if (bookingSessionId) {
                // Xóa connection khỏi danh sách active
                const activeConns = sessionConnections.get(bookingSessionId);
                if (activeConns) {
                    activeConns.delete(socket.id);
                    if (activeConns.size === 0) {
                        sessionConnections.delete(bookingSessionId);
                    }
                }

                // Chỉ thực hiện dọn dẹp nếu KHÔNG còn kết nối nào active cho session này
                const hasActive = sessionConnections.has(bookingSessionId) && sessionConnections.get(bookingSessionId).size > 0;
                if (!hasActive) {
                    // Hủy timeout cũ nếu đang chạy
                    if (disconnectTimeouts.has(bookingSessionId)) {
                        clearTimeout(disconnectTimeouts.get(bookingSessionId));
                    }

                    // Cấu hình Grace Period 8 giây để chờ người dùng chuyển trang
                    const timeoutId = setTimeout(() => {
                        // Kiểm tra lại một lần nữa trước khi thực tế xóa
                        const stillHasActive = sessionConnections.has(bookingSessionId) && sessionConnections.get(bookingSessionId).size > 0;
                        if (!stillHasActive) {
                            const userSeats = sessionToSeats.get(bookingSessionId);
                            if (userSeats) {
                                for (const seatKey of userSeats) {
                                    const lockInfo = lockedSeats.get(seatKey);
                                    if (lockInfo && lockInfo.bookingSessionId === bookingSessionId) {
                                        clearTimeout(lockInfo.timerId);
                                        lockedSeats.delete(seatKey);

                                        const [showtimeId, seatId] = seatKey.split('_');
                                        const room = `room_showtime_${showtimeId}`;

                                        io.to(room).emit('seatStatusUpdated', {
                                            showtimeId: parseInt(showtimeId, 10),
                                            seatId,
                                            status: 'Trống'
                                        });
                                        console.log(`[Socket] 🧹 Grace period hết hạn: Giải phóng ghế ${seatId} | showtime ${showtimeId} (Session: ${bookingSessionId})`);
                                    }
                                }
                                sessionToSeats.delete(bookingSessionId);
                            }
                            disconnectTimeouts.delete(bookingSessionId);
                        }
                    }, 8000); // 8 giây grace period

                    disconnectTimeouts.set(bookingSessionId, timeoutId);
                } else {
                    console.log(`[Socket] Session ${bookingSessionId} vẫn còn ${sessionConnections.get(bookingSessionId).size} kết nối hoạt động. Bỏ qua dọn dẹp.`);
                }
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

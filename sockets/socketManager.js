const sessionConnections = new Map(); // key: bookingSessionId, value: Set<socketId>

let _io = null;
const BookingModel = require('../models/bookingModel');

const SEAT_TIMEOUT = 5; // minutes

module.exports = (io) => {
    _io = io;

    io.on('connection', (socket) => {
        const bookingSessionId = socket.handshake.query.bookingSessionId || socket.id;
        console.log(`[Socket] Client connected: ${socket.id} | Session: ${bookingSessionId}`);

        if (!sessionConnections.has(bookingSessionId)) {
            sessionConnections.set(bookingSessionId, new Set());
        }
        sessionConnections.get(bookingSessionId).add(socket.id);

        socket.on('joinShowtime', (showtimeId) => {
            const room = `room_showtime_${showtimeId}`;
            socket.join(room);
            console.log(`[Socket] Client ${socket.id} joined ${room}`);
        });

        socket.on('joinPaymentRoom', async (ticketIds) => {
            if (!Array.isArray(ticketIds) || ticketIds.length === 0) return;

            const sortedIds = [...ticketIds].map(Number).sort((a, b) => a - b);
            const room = `payment_${sortedIds.join('_')}`;
            socket.join(room);
            console.log(`[Socket] Client ${socket.id} joined payment room: ${room}`);
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

        socket.on('leavePaymentRoom', (ticketIds) => {
            if (!Array.isArray(ticketIds) || ticketIds.length === 0) return;
            const sortedIds = [...ticketIds].map(Number).sort((a, b) => a - b);
            const room = `payment_${sortedIds.join('_')}`;
            socket.leave(room);
            console.log(`[Socket] Client ${socket.id} left payment room: ${room}`);
        });

        socket.on('reclaimSeats', async ({ showtimeId, seatIds, sessionId }) => {
            const sid = sessionId || bookingSessionId;
            if (!Array.isArray(seatIds) || !sid) return;

            try {
                await BookingModel.reclaimSeatsDB(showtimeId, seatIds, sid, socket.id);
                console.log(`[Socket] Reclaimed seat sockets for session ${sid}`);
            } catch (err) {
                console.error('[Socket reclaimSeats error]', err);
            }
        });

        socket.on('holdSeat', async ({ showtimeId, seatId }) => {
            const room = `room_showtime_${showtimeId}`;

            try {
                const hold = await BookingModel.holdSeatDB(showtimeId, seatId, bookingSessionId, socket.id, SEAT_TIMEOUT);
                if (!hold?.ok) {
                    socket.emit('seatHoldFailed', {
                        seatId,
                        message: 'Ghe da co nguoi chon',
                        remainingSeconds: hold?.remainingSeconds || 0
                    });
                    return;
                }

                socket.emit('seatHoldConfirmed', {
                    showtimeId,
                    seatId,
                    expiresAt: hold.expiresAt,
                    remainingSeconds: hold.remainingSeconds
                });

                io.to(room).emit('seatStatusUpdated', {
                    showtimeId,
                    seatId,
                    status: 'Đang chọn',
                    expiresAt: hold.expiresAt,
                    remainingSeconds: hold.remainingSeconds
                });

                console.log(`[Socket] Locked seat ${seatId} | showtime ${showtimeId} | session ${bookingSessionId}`);

                const timeoutMs = Math.max(1000, (Number(hold.remainingSeconds || 0) + 1) * 1000);
                setTimeout(async () => {
                    try {
                        const deleted = await BookingModel.releaseExpiredSeatLock(showtimeId, seatId);
                        if (deleted) {
                            io.to(room).emit('seatStatusUpdated', { showtimeId, seatId, status: 'Trống' });
                            console.log(`[Socket] Expired seat lock ${seatId} | showtime ${showtimeId}`);
                        }
                    } catch (err) {
                        console.error('[Socket timeout release error]', err);
                    }
                }, timeoutMs);
            } catch (err) {
                console.error('[Socket holdSeat error]', err);
            }
        });

        socket.on('releaseSeat', async ({ showtimeId, seatId, bookingSessionId: payloadSessionId }) => {
            const sid = payloadSessionId || bookingSessionId;
            try {
                const released = await BookingModel.releaseSeatDB(showtimeId, seatId, sid);
                if (released) {
                    const room = `room_showtime_${showtimeId}`;
                    io.to(room).emit('seatStatusUpdated', { showtimeId, seatId, status: 'Trống' });
                    console.log(`[Socket] Released seat ${seatId} | showtime ${showtimeId} by session ${sid}`);
                }
            } catch (err) {
                console.error('[Socket releaseSeat error]', err);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Client disconnected: ${socket.id} | Session: ${bookingSessionId}`);

            const activeConns = sessionConnections.get(bookingSessionId);
            if (!activeConns) return;

            activeConns.delete(socket.id);
            if (activeConns.size === 0) {
                sessionConnections.delete(bookingSessionId);
            }
        });
    });
};

module.exports.getLockedSeats = () => {
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
    console.log(`[Socket] Emitted payment_confirmed to room: ${room}`);
};

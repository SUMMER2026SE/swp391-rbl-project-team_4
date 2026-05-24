const lockedSeats = new Map(); // key: `${showtimeId}_${seatId}`, value: { socketId, timerId, timestamp }
const socketToSeats = new Map(); // key: socketId, value: Set of `${showtimeId}_${seatId}`

const SEAT_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

module.exports = (io) => {
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

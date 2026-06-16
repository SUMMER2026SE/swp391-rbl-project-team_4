const { sql, getPool } = require('../config/db');

(async () => {
  try {
    const pool = await getPool();
    console.log('[Reseed] Connected to SQL Server.');

    // 1. Delete transactional data in correct dependency order
    console.log('[Reseed] Clearing old transaction and seat data...');
    await pool.request().query('DELETE FROM ShowtimeSeats');
    await pool.request().query('DELETE FROM BookingTickets');
    await pool.request().query('DELETE FROM Booking_FnB');
    await pool.request().query('DELETE FROM Bookings');
    await pool.request().query('DELETE FROM Ticket_FnB');
    await pool.request().query('DELETE FROM Tickets');
    await pool.request().query('DELETE FROM Seats');
    console.log('[Reseed] Cleared existing seats and ticket records.');

    // 2. Fetch all rooms
    const roomsResult = await pool.request().query('SELECT RoomID, RoomName FROM Rooms');
    const rooms = roomsResult.recordset;
    console.log(`[Reseed] Found ${rooms.length} rooms to seed.`);

    // 3. Define layout generator helper
    for (const room of rooms) {
      const { RoomID, RoomName } = room;
      const seats = [];

      let isImax = RoomName.toLowerCase().includes('imax');
      let isVipOrPremium = (RoomName.toLowerCase().includes('vip') || RoomName.toLowerCase().includes('lounge') || RoomName.toLowerCase().includes('premium')) && !RoomName.toLowerCase().includes('sweetbox');
      let isSweetboxOnly = RoomName.toLowerCase().includes('sweetbox') || RoomName.toLowerCase().includes('couple');

      if (isImax) {
        // IMAX Layout: 12 rows (A to M, skipping I)
        // Rows A-E: Normal (18 columns)
        // Rows F-L: VIP (18 columns)
        // Row M: Couple (16 columns -> 8 pairs)
        const normalRows = ['A', 'B', 'C', 'D', 'E'];
        const vipRows = ['F', 'G', 'H', 'J', 'K', 'L'];
        const coupleRows = ['M'];

        // Normal
        for (const row of normalRows) {
          for (let col = 1; col <= 18; col++) {
            seats.push({ row, col, type: 'Normal', multiplier: 1.0 });
          }
        }
        // VIP
        for (const row of vipRows) {
          for (let col = 1; col <= 18; col++) {
            seats.push({ row, col, type: 'VIP', multiplier: 1.5 });
          }
        }
        // Couple
        for (const row of coupleRows) {
          for (let col = 1; col <= 16; col++) {
            seats.push({ row, col, type: 'Couple', multiplier: 2.0 });
          }
        }
      } else if (isVipOrPremium) {
        // VIP Lounge Layout: 6 rows (A to F)
        // Rows A-E: VIP (8 columns)
        // Row F: Couple (8 columns -> 4 pairs)
        const vipRows = ['A', 'B', 'C', 'D', 'E'];
        const coupleRows = ['F'];

        for (const row of vipRows) {
          for (let col = 1; col <= 8; col++) {
            seats.push({ row, col, type: 'VIP', multiplier: 1.5 });
          }
        }
        for (const row of coupleRows) {
          for (let col = 1; col <= 8; col++) {
            seats.push({ row, col, type: 'Couple', multiplier: 2.0 });
          }
        }
      } else if (isSweetboxOnly) {
        // Sweetbox Room Layout: 6 rows (A to F)
        // All seats are Couple
        const coupleRows = ['A', 'B', 'C', 'D', 'E', 'F'];
        for (const row of coupleRows) {
          for (let col = 1; col <= 10; col++) {
            seats.push({ row, col, type: 'Couple', multiplier: 2.0 });
          }
        }
      } else {
        // Standard Layout: 10 rows (A to K, skipping I)
        // Rows A-E: Normal (14 columns)
        // Rows F-J: VIP (14 columns)
        // Row K: Couple (12 columns -> 6 pairs)
        const normalRows = ['A', 'B', 'C', 'D', 'E'];
        const vipRows = ['F', 'G', 'H', 'J'];
        const coupleRows = ['K'];

        // Normal
        for (const row of normalRows) {
          for (let col = 1; col <= 14; col++) {
            seats.push({ row, col, type: 'Normal', multiplier: 1.0 });
          }
        }
        // VIP
        for (const row of vipRows) {
          for (let col = 1; col <= 14; col++) {
            seats.push({ row, col, type: 'VIP', multiplier: 1.5 });
          }
        }
        // Couple
        for (const row of coupleRows) {
          for (let col = 1; col <= 12; col++) {
            seats.push({ row, col, type: 'Couple', multiplier: 2.0 });
          }
        }
      }

      console.log(`[Reseed] Room ${RoomID} (${RoomName}) gets ${seats.length} seats.`);

      // Insert seats using transactional transaction
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        for (const seat of seats) {
          const req = new sql.Request(transaction);
          await req
            .input('roomId', sql.Int, RoomID)
            .input('seatRow', sql.VarChar, seat.row)
            .input('seatNumber', sql.Int, seat.col)
            .input('seatType', sql.VarChar, seat.type)
            .input('priceMultiplier', sql.Decimal(18,2), seat.multiplier)
            .query(`
              INSERT INTO Seats (RoomID, SeatRow, SeatNumber, SeatType, PriceMultiplier)
              VALUES (@roomId, @seatRow, @seatNumber, @seatType, @priceMultiplier)
            `);
        }

        // Update Room's TotalSeats count
        const reqRoom = new sql.Request(transaction);
        await reqRoom
          .input('roomId', sql.Int, RoomID)
          .input('totalSeats', sql.Int, seats.length)
          .query('UPDATE Rooms SET TotalSeats = @totalSeats WHERE RoomID = @roomId');

        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        console.error(`[Reseed] ❌ Error inserting seats for room ${RoomID}:`, err.message);
        throw err;
      }
    }

    console.log('[Reseed] ✅ Reseeded all seats successfully!');
    process.exit(0);
  } catch (e) {
    console.error('[Reseed] ❌ Critical failure:', e.message);
    process.exit(1);
  }
})();

/**
 * set_all_showtimes.js
 * Tạo lịch chiếu cho TẤT CẢ phim tại TẤT CẢ rạp
 * 3 suất / ngày trong 7 ngày tới
 * Chạy: node scratch/set_all_showtimes.js
 */

const { sql, dbConfig } = require('../config/db');

async function main() {
    console.log('🔌 Đang kết nối SQL Server...');
    const pool = await sql.connect(dbConfig);
    console.log('✅ Kết nối thành công!\n');

    try {
        // 1. Lấy danh sách tất cả phim đang chiếu + sắp chiếu
        const moviesResult = await pool.request().query(`
            SELECT MovieID, Title, Duration, Status
            FROM Movies
            WHERE Status IN ('Now Showing', 'Coming Soon')
            ORDER BY MovieID
        `);
        const movies = moviesResult.recordset;
        console.log(`📽️  Tìm thấy ${movies.length} phim:`, movies.map(m => `[${m.MovieID}] ${m.Title}`));

        // 2. Lấy danh sách tất cả phòng chiếu kèm CinemaID
        const roomsResult = await pool.request().query(`
            SELECT r.RoomID, r.RoomName, r.CinemaID, c.CinemaName
            FROM Rooms r
            JOIN Cinemas c ON r.CinemaID = c.CinemaID
            ORDER BY r.CinemaID, r.RoomID
        `);
        const rooms = roomsResult.recordset;
        console.log(`🏢 Tìm thấy ${rooms.length} phòng chiếu tại ${[...new Set(rooms.map(r => r.CinemaID))].length} rạp.\n`);

        // 3. Kiểm tra / xóa lịch chiếu cũ (active) trong 7 ngày tới để tránh trùng
        const clearResult = await pool.request().query(`
            DELETE FROM Showtimes
            WHERE StartTime >= CAST(CAST(GETDATE() AS DATE) AS DATETIME)
              AND StartTime <  DATEADD(day, 8, CAST(CAST(GETDATE() AS DATE) AS DATETIME))
              AND Status = 'active'
        `);
        console.log(`🗑️  Đã xóa ${clearResult.rowsAffected[0]} suất chiếu cũ trong 7 ngày tới.\n`);

        // 4. Xóa ShowtimeSeats liên quan (nếu có FK)
        // (Script trên đã xử lý cascade nếu có ON DELETE CASCADE, nếu không cần xóa thủ công)

        // 5. Tính ngày hôm nay (0h)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Khung giờ chiếu: 10:00, 15:00, 20:00
        const slotHours = [10, 15, 20];
        // Giá theo giờ
        const slotPrices = [90000, 90000, 110000];

        // Nhóm phòng theo Cinema
        const cinemaRooms = {};
        rooms.forEach(r => {
            if (!cinemaRooms[r.CinemaID]) cinemaRooms[r.CinemaID] = [];
            cinemaRooms[r.CinemaID].push(r);
        });

        let totalInserted = 0;

        // 6. Vòng lặp: 7 ngày x tất cả rạp x tất cả phim
        for (let dayOffset = 0; dayOffset <= 6; dayOffset++) {
            const dayDate = new Date(today);
            dayDate.setDate(today.getDate() + dayOffset);

            for (const [cinemaId, cRooms] of Object.entries(cinemaRooms)) {
                const roomCount = cRooms.length;

                for (let mi = 0; mi < movies.length; mi++) {
                    const movie = movies[mi];
                    const duration = movie.Duration > 0 ? movie.Duration : 120;

                    // Phân phối phim vào phòng theo vòng (round-robin)
                    const assignedRoom = cRooms[mi % roomCount];

                    for (let si = 0; si < slotHours.length; si++) {
                        const startTime = new Date(dayDate);
                        startTime.setHours(slotHours[si], 0, 0, 0);

                        const endTime = new Date(startTime);
                        endTime.setMinutes(endTime.getMinutes() + duration);

                        const basePrice = slotPrices[si];

                        await pool.request()
                            .input('MovieID', sql.Int, movie.MovieID)
                            .input('RoomID', sql.Int, assignedRoom.RoomID)
                            .input('StartTime', sql.DateTime, startTime)
                            .input('EndTime', sql.DateTime, endTime)
                            .input('BasePrice', sql.Decimal(10, 2), basePrice)
                            .input('Status', sql.VarChar(50), 'active')
                            .query(`
                                INSERT INTO Showtimes (MovieID, RoomID, StartTime, EndTime, BasePrice, Status)
                                VALUES (@MovieID, @RoomID, @StartTime, @EndTime, @BasePrice, @Status)
                            `);

                        totalInserted++;
                    }
                }
            }

            console.log(`  ✅ Ngày +${dayOffset} (${dayDate.toLocaleDateString('vi-VN')}): đã tạo xong.`);
        }

        console.log(`\n🎉 Hoàn tất! Đã tạo tổng cộng ${totalInserted} suất chiếu.`);

        // 7. Tạo ShowtimeSeats cho các suất mới
        console.log('\n🪑 Đang tạo ShowtimeSeats cho các suất mới...');
        await pool.request().query(`
            INSERT INTO ShowtimeSeats (ShowtimeID, SeatID, Status)
            SELECT st.ShowtimeID, s.SeatID, 'Available'
            FROM Showtimes st
            JOIN Rooms r ON st.RoomID = r.RoomID
            JOIN Seats s ON s.RoomID = r.RoomID
            WHERE st.StartTime >= CAST(CAST(GETDATE() AS DATE) AS DATETIME)
              AND st.StartTime < DATEADD(day, 8, CAST(CAST(GETDATE() AS DATE) AS DATETIME))
              AND st.Status = 'active'
              AND NOT EXISTS (
                SELECT 1 FROM ShowtimeSeats ss
                WHERE ss.ShowtimeID = st.ShowtimeID AND ss.SeatID = s.SeatID
              )
        `);
        console.log('✅ ShowtimeSeats đã được tạo đầy đủ!');

    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        console.error(err);
    } finally {
        await pool.close();
        console.log('\n🔌 Đã đóng kết nối DB.');
    }
}

main();

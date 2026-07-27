const bcrypt = require('bcryptjs');
const { getPool, sql } = require('./config/db');

async function seedTestUser() {
    try {
        const pool = await getPool();

        const email = 'testai@example.com';
        const rawPassword = 'password123';
        const hashedPassword = await bcrypt.hash(rawPassword, 10);
        
        // 1. Kiểm tra và tạo tài khoản
        let userId;
        const userCheck = await pool.request()
            .input('Email', sql.NVarChar, email)
            .query(`SELECT UserID FROM Users WHERE Email = @Email`);

        if (userCheck.recordset.length > 0) {
            userId = userCheck.recordset[0].UserID;
            console.log(`Tài khoản test đã tồn tại: ${email} (ID: ${userId})`);
        } else {
            console.log(`Đang tạo tài khoản test: ${email}...`);
            const insertUser = await pool.request()
                .input('FullName', sql.NVarChar, 'AI Tester')
                .input('Email', sql.NVarChar, email)
                .input('PasswordHash', sql.NVarChar, hashedPassword)
                .input('Phone', sql.NVarChar, '0123456789')
                .input('RoleID', sql.Int, 2) // Customer
                .query(`
                    INSERT INTO Users (FullName, Email, PasswordHash, Phone, RoleID, IsActive)
                    OUTPUT INSERTED.UserID
                    VALUES (@FullName, @Email, @PasswordHash, @Phone, @RoleID, 1)
                `);
            userId = insertUser.recordset[0].UserID;
            console.log(`Đã tạo thành công tài khoản test (ID: ${userId})`);
        }

        // Chọn 3 phim khác nhau để có lịch sử xem phim đa dạng (ví dụ: hành động, khoa học viễn tưởng, kịch)
        const showtimesResult = await pool.request().query(`
            SELECT ShowtimeID, Title, MovieID 
            FROM (
                SELECT st.ShowtimeID, m.Title, m.MovieID,
                       ROW_NUMBER() OVER(PARTITION BY m.MovieID ORDER BY st.StartTime DESC) as rn
                FROM Showtimes st
                JOIN Movies m ON st.MovieID = m.MovieID
                WHERE st.Status = 'active'
            ) AS DistinctMovies
            WHERE rn = 1
            ORDER BY NEWID() -- Lấy ngẫu nhiên
            OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY;
        `);

        if (showtimesResult.recordset.length === 0) {
            console.log('Không tìm thấy suất chiếu nào để tạo lịch sử. Vui lòng chạy seed_showtimes_test.js trước.');
            process.exit(1);
        }

        console.log('Đang tạo lịch sử booking cho người dùng...');
        let i = 1;
        for (const st of showtimesResult.recordset) {
            // Check if booking already exists
            const ticketCheck = await pool.request()
                .input('UserId', sql.Int, userId)
                .input('ShowtimeId', sql.Int, st.ShowtimeID)
                .query(`SELECT TicketID FROM Tickets WHERE UserID = @UserId AND ShowtimeID = @ShowtimeId AND Status = 'confirmed'`);
            
            if (ticketCheck.recordset.length === 0) {
                // Lấy 1 ghế trống bất kỳ của suất chiếu này
                const seatRes = await pool.request()
                    .input('ShowtimeId', sql.Int, st.ShowtimeID)
                    .query(`
                        SELECT TOP 1 s.SeatID 
                        FROM Seats s
                        JOIN Showtimes st ON s.RoomID = st.RoomID
                        WHERE st.ShowtimeID = @ShowtimeId
                    `);
                
                let seatId = seatRes.recordset.length > 0 ? seatRes.recordset[0].SeatID : 1;

                await pool.request()
                    .input('UserId', sql.Int, userId)
                    .input('ShowtimeId', sql.Int, st.ShowtimeID)
                    .input('SeatId', sql.Int, seatId)
                    .input('TotalAmount', sql.Decimal, 85000)
                    .input('QRCode', sql.NVarChar, 'TEST-QR-' + Date.now() + i)
                    .query(`
                        INSERT INTO Tickets (UserID, ShowtimeID, SeatID, TicketPrice, TotalAmount, PaymentMethod, Status, BookedAt, QRCode)
                        VALUES (@UserId, @ShowtimeId, @SeatId, 85000, @TotalAmount, 'momo', 'confirmed', GETDATE(), @QRCode)
                    `);
                console.log(`Đã thêm lịch sử xem phim: ${st.Title} (MovieID: ${st.MovieID})`);
            } else {
                console.log(`Đã có lịch sử xem phim: ${st.Title} (MovieID: ${st.MovieID})`);
            }
            i++;
        }

        console.log('\\n--- THÔNG TIN TÀI KHOẢN TEST ---');
        console.log(`Email: ${email}`);
        console.log(`Password: ${rawPassword}`);
        console.log('Bạn có thể dùng tài khoản này để đăng nhập và test AI trên trang chủ.');

        process.exit(0);

    } catch (err) {
        console.error('Error seeding test user:', err);
        process.exit(1);
    }
}

seedTestUser();

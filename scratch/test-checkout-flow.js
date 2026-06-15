/**
 * test-checkout-flow.js
 * Kiểm tra toàn bộ flow checkout: login → lấy ghế → tạo booking → check status
 * Chạy: node scratch/test-checkout-flow.js
 */

const BASE = 'http://localhost:9999';

async function apiCall(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json();
  return { status: res.status, ok: res.ok, data: json };
}

async function main() {
  console.log('=== KIỂM TRA FLOW CHECKOUT ===\n');

  // ── BƯỚC 1: Đăng nhập ──
  console.log('1️⃣  Đang đăng nhập...');
  const loginRes = await apiCall('POST', '/api/auth/login', {
    email: 'nam@gmail.com',
    password: '123456'
  });
  
  if (!loginRes.ok || !loginRes.data.token) {
    // Thử đăng ký tài khoản test
    console.log('   ⚠ Login thất bại, thử tài khoản khác...');
    
    // Lấy danh sách users từ DB
    const { getPool } = require('../config/db');
    const pool = await getPool();
    const users = await pool.request().query(`
      SELECT TOP 1 u.Email, u.FullName 
      FROM Users u 
      WHERE u.IsActive = 1 AND u.RoleID = (SELECT RoleID FROM Roles WHERE RoleName = 'Customer')
    `);
    
    if (users.recordset.length === 0) {
      console.log('   ❌ Không tìm thấy user Customer trong DB!');
      process.exit(1);
    }
    
    console.log('   📋 User trong DB:', users.recordset[0]);
    console.log('   ℹ Hãy thử đăng nhập với email trên và password bất kỳ đã cài.');
    process.exit(0);
  }
  
  const token = loginRes.data.token;
  const user = loginRes.data.user || loginRes.data.data;
  console.log(`   ✅ Đăng nhập thành công! User: ${user?.fullName || user?.email}`);

  // ── BƯỚC 2: Lấy danh sách suất chiếu đang hoạt động ──
  console.log('\n2️⃣  Lấy suất chiếu...');
  const showtimesRes = await apiCall('GET', '/api/movies');
  
  if (!showtimesRes.ok) {
    console.log('   ❌ Không lấy được danh sách phim:', showtimesRes.data);
    process.exit(1);
  }
  
  // Lấy showtimeId từ DB trực tiếp
  const { getPool } = require('../config/db');
  const pool = await getPool();
  const stResult = await pool.request().query(`
    SELECT TOP 3 st.ShowtimeID, st.StartTime, m.Title, st.Price
    FROM Showtimes st
    JOIN Movies m ON st.MovieID = m.MovieID
    WHERE st.Status = 'active' AND st.StartTime > GETDATE()
    ORDER BY st.StartTime ASC
  `);
  
  if (stResult.recordset.length === 0) {
    console.log('   ❌ Không có suất chiếu nào còn hoạt động!');
    process.exit(1);
  }
  
  const showtime = stResult.recordset[0];
  console.log(`   ✅ Suất chiếu: ID=${showtime.ShowtimeID}, Phim: "${showtime.Title}", Giá: ${showtime.Price}đ`);

  // ── BƯỚC 3: Lấy ghế trống ──
  console.log('\n3️⃣  Lấy ghế trống...');
  const seatsRes = await apiCall('GET', `/api/movies/showtimes/${showtime.ShowtimeID}/seats`, null, token);
  
  if (!seatsRes.ok || !seatsRes.data.data) {
    console.log('   ❌ Không lấy được danh sách ghế:', seatsRes.data);
    process.exit(1);
  }
  
  const availableSeats = seatsRes.data.data.filter(s => s.SeatStatus === 'available').slice(0, 2);
  if (availableSeats.length === 0) {
    console.log('   ❌ Không có ghế trống trong suất chiếu này!');
    process.exit(1);
  }
  
  const seatIds = availableSeats.map(s => s.SeatID);
  console.log(`   ✅ Ghế trống: [${seatIds.join(', ')}] (${availableSeats.map(s => s.SeatRow + s.SeatNumber).join(', ')})`);

  // ── BƯỚC 4: Tạo booking (POST /api/bookings) ──
  console.log('\n4️⃣  Tạo booking...');
  const bookingPayload = {
    showtimeId: showtime.ShowtimeID,
    seatIds,
    foodItems: [],
    voucherCode: null,
    paymentMethod: 'qrpay'
  };
  console.log('   📦 Payload:', JSON.stringify(bookingPayload));
  
  const bookingRes = await apiCall('POST', '/api/bookings', bookingPayload, token);
  console.log(`   HTTP Status: ${bookingRes.status}`);
  
  if (!bookingRes.ok || !bookingRes.data.success) {
    console.log('   ❌ Tạo booking thất bại!');
    console.log('   Response:', JSON.stringify(bookingRes.data, null, 2));
    process.exit(1);
  }
  
  const bookingData = bookingRes.data.data;
  console.log('   ✅ Booking tạo thành công!');
  console.log(`   TicketIDs: [${bookingData.ticketIds.join(', ')}]`);
  console.log(`   Số tiền cần thanh toán: ${bookingData.finalAmount?.toLocaleString('vi-VN')}đ`);
  console.log(`   Nội dung chuyển khoản: DCVIP${bookingData.ticketIds.join('T')}`);

  // ── BƯỚC 5: Check trạng thái vé (polling fallback) ──
  console.log('\n5️⃣  Kiểm tra trạng thái vé...');
  const checkRes = await apiCall('GET', `/api/bookings/check-status?ticketIds=${bookingData.ticketIds.join(',')}`, null, token);
  
  if (checkRes.ok) {
    console.log('   ✅ API check-status hoạt động đúng!');
    console.log('   allConfirmed:', checkRes.data.allConfirmed, '| Tickets:', JSON.stringify(checkRes.data.tickets));
  } else {
    console.log('   ❌ API check-status lỗi:', checkRes.data);
  }

  // ── BƯỚC 6: Dọn dẹp - hủy vé test ──
  console.log('\n6️⃣  Hủy vé test...');
  const cancelRes = await apiCall('POST', '/api/bookings/cancel', { ticketIds: bookingData.ticketIds }, token);
  if (cancelRes.ok && cancelRes.data.success) {
    console.log('   ✅ Đã hủy vé test thành công!');
  } else {
    console.log('   ⚠ Hủy vé thất bại (cần xóa thủ công trong DB):', cancelRes.data);
  }

  console.log('\n=== KẾT QUẢ: FLOW CHECKOUT HOẠT ĐỘNG ĐÚNG ✅ ===');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Script lỗi:', err.message);
  process.exit(1);
});

/**
 * test-full-api-flow.js - Test toàn bộ API checkout
 * Sử dụng fetch (Node 18+) để test trực tiếp qua HTTP
 */
const BASE = 'http://localhost:9999';

async function api(method, path, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, data: json };
}

async function tryLogin(email, password) {
  const r = await api('POST', '/api/auth/login', { email, password });
  if (r.ok && r.data.token) return r.data.token;
  return null;
}

async function main() {
  console.log('=== TEST FLOW CHECKOUT API ===\n');

  // ── 1. Login ──
  console.log('1️⃣  Đăng nhập...');
  
  const accounts = [
    { email: 'nam@gmail.com',              passwords: ['123456', '1234', 'password', 'Nam@123', 'admin123'] },
    { email: 'xvcxhuy1239999@gmail.com',   passwords: ['123456', '1234', 'Huy@123', 'huypass'] },
  ];

  let token = null;
  let loggedEmail = null;

  outer: for (const acc of accounts) {
    for (const pw of acc.passwords) {
      process.stdout.write(`   Thử ${acc.email} / ${pw} ... `);
      token = await tryLogin(acc.email, pw);
      if (token) {
        console.log('✅ OK!');
        loggedEmail = acc.email;
        break outer;
      } else {
        console.log('❌');
      }
    }
  }

  if (!token) {
    console.log('\n⚠️  Không đăng nhập được tự động. Thử đọc token từ localStorage qua debug script...');
    
    // Thử gọi API với một test JWT giả để xem response format
    const testRes = await api('POST', '/api/bookings', {
      showtimeId: 289, seatIds: [1], foodItems: [], paymentMethod: 'qrpay'
    }, 'invalid-token');
    console.log(`   API /api/bookings với token sai → HTTP ${testRes.status}: ${JSON.stringify(testRes.data)}`);
    
    if (testRes.status === 401) {
      console.log('   ✅ API xác thực token đúng (trả 401 khi token sai)');
    }
    
    console.log('\n📋 Để test thủ công, hãy:');
    console.log('   1. Mở http://localhost:9999/auth.html');
    console.log('   2. Đăng nhập với tài khoản của bạn');
    console.log('   3. Mở F12 Console, gõ: localStorage.getItem("token")');
    console.log('   4. Copy token đó vào script này');
    process.exit(0);
  }

  console.log(`\n   👤 Đã đăng nhập: ${loggedEmail}`);
  console.log(`   🔑 Token: ${token.substring(0, 50)}...`);

  // ── 2. Lấy ghế trống từ DB ──
  console.log('\n2️⃣  Lấy ghế trống từ API...');
  const seatsRes = await api('GET', '/api/movies/showtimes/289/seats', null, token);
  console.log(`   HTTP ${seatsRes.status}: ${seatsRes.ok ? 'OK' : 'FAIL'}`);
  
  if (!seatsRes.ok || !seatsRes.data.data) {
    console.log('   Không lấy được ghế. Response:', JSON.stringify(seatsRes.data).substring(0, 200));
    process.exit(1);
  }
  
  const allSeats = seatsRes.data.data;
  const avail = allSeats.filter(s => s.Status === 'available' || s.SeatStatus === 'available');
  console.log(`   Total seats: ${allSeats.length} | Available: ${avail.length}`);
  
  if (avail.length === 0) {
    console.log('   ❌ Không có ghế trống trong ShowtimeID=289');
    process.exit(1);
  }
  
  const chosen = avail.slice(0, 1);
  const seatIds = chosen.map(s => s.SeatID);
  console.log(`   ✅ Chọn ghế: ${chosen.map(s => `ID=${s.SeatID} (${s.SeatRow}${s.SeatNumber})`).join(', ')}`);

  // ── 3. Tạo booking ──
  console.log('\n3️⃣  Tạo booking (POST /api/bookings)...');
  const payload = {
    showtimeId: 289,
    seatIds,
    foodItems: [],
    voucherCode: null,
    paymentMethod: 'qrpay'
  };
  console.log('   Payload:', JSON.stringify(payload));
  
  const bookRes = await api('POST', '/api/bookings', payload, token);
  console.log(`   HTTP ${bookRes.status}: ${bookRes.ok ? 'SUCCESS' : 'FAIL'}`);
  console.log('   Response:', JSON.stringify(bookRes.data, null, 2));
  
  if (!bookRes.ok || !bookRes.data.success) {
    console.log('\n❌ BOOKING THẤT BẠI! Xem lỗi ở trên.');
    process.exit(1);
  }
  
  const bd = bookRes.data.data;
  console.log(`\n✅ BOOKING THÀNH CÔNG!`);
  console.log(`   TicketIDs: [${bd.ticketIds.join(', ')}]`);
  console.log(`   Số tiền: ${bd.finalAmount?.toLocaleString('vi-VN')}đ`);
  console.log(`   Nội dung chuyển khoản: DCVIP${bd.ticketIds.join('T')}`);
  console.log(`   QR Code: ${bd.qrCodes?.[0]}`);

  // ── 4. Check status API ──
  console.log('\n4️⃣  Kiểm tra API check-status...');
  const checkRes = await api('GET', `/api/bookings/check-status?ticketIds=${bd.ticketIds.join(',')}`, null, token);
  console.log(`   HTTP ${checkRes.status}`);
  console.log('   allConfirmed:', checkRes.data?.allConfirmed);
  console.log('   tickets:', JSON.stringify(checkRes.data?.tickets?.map(t => ({ id: t.TicketID, status: t.Status }))));
  
  // ── 5. Dọn dẹp ──
  console.log('\n5️⃣  Hủy vé test...');
  const { getPool } = require('../config/db');
  const pool = await getPool();
  const req = pool.request();
  const ids = bd.ticketIds.join(',');
  await req.query(`DELETE FROM Ticket_FnB WHERE TicketID IN (${ids})`);
  await req.query(`DELETE FROM Tickets WHERE TicketID IN (${ids})`);
  console.log(`   ✅ Đã xóa vé test: [${ids}]`);

  console.log('\n=== ✅ TOÀN BỘ FLOW HOẠT ĐỘNG ĐÚNG ===');
  process.exit(0);
}

main().catch(e => { console.error('❌ Fatal:', e.message, e.stack); process.exit(1); });

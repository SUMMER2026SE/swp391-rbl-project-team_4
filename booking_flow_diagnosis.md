# 🔍 BÁO CÁO CHẨN ĐOÁN TOÀN DIỆN — Luồng Đặt Vé D-CINEMA (v3 FINAL)

**Luồng:** `booking.html` → `seats.html` → `concessions.html` → `checkout.html` → `payment-success.html` → `verify-ticket.html`

> [!IMPORTANT]
> Vai trò: **Code Reviewer**. Báo cáo này CHỈ chỉ ra lỗi và hướng tư duy. TUYỆT ĐỐI KHÔNG viết code sửa.

---

## 📊 Bảng Tổng Hợp 23 Lỗi

| # | Trang / File | Dòng | Mức | Loại | Mô tả ngắn |
|---|---|---|---|---|---|
| 1 | `checkout.html` | 2039–2056 | 🔴 CRASH | State | Xoá booking khi `completed=true`, phá payment-success khi Back |
| 2 | `checkout.html` | 1465–1491 | 🔴 CRASH | Button/Logic | `closeQrModal()` xoá `ticketIds`, HUỶ VÉ ngay khi user đóng modal |
| 3 | `checkout.html` | 1546–1547 | 🔴 CRASH | Socket | Emit `leavePaymentRoom` nhưng server không có handler — unhandled |
| 4 | `checkout.html` | 1550 | 🔴 CRASH | Logic | `handlePaymentSuccess` tự tính lại `finalAmt` phía client, bỏ qua backend |
| 5 | `checkout.html` | 1733–1777 | 🔴 CRASH | Timer | Countdown 5 phút cứng — không sync với thời gian lock thực từ DB |
| 6 | `checkout.html` | 1859 | 🔴 CRASH | Session | `sessionId` gửi null → backend skip seat lock check |
| 7 | `seats.html` | 1741–1744 | 🔴 CRASH | Auth | Auth check NGOÀI DOMContentLoaded — race condition, double redirect |
| 8 | `seats.html` | 1911 | 🔴 CRASH | Session | `bookingSessionId` không bao giờ được set → `sessId = ''` → khôi phục ghế luôn thất bại |
| 9 | `bookingController.js` | 895 | 🔴 CRASH | Backend | `totalAmount = ticketSum`, bỏ sót `fnbSum` → tiền hiển thị sai |
| 10 | `socketManager.js` | 108–111 | 🔴 CRASH | Socket | `releaseSeat` bị ignored hoàn toàn — tính năng thủ công giải phóng ghế CHẾT |
| 11 | `payment-success.html` | 1394–1416 | 🔴 CRASH | State | `totalAmount || 2400` — hardcode fallback, hiển thị dữ liệu demo thật |
| 12 | `concessions.html` | 1095–1097 | ⚠️ RISK | UI | Khi `!booking.showtimeId`: chỉ set `title` attribute, không disable thật nút `btnContinue` |
| 13 | `concessions.html` | 925 | ⚠️ RISK | Logic | `totalAmount = BASE_TICKET + fbTotal` tính hoàn toàn phía client, không verify backend |
| 14 | `checkout.html` | 838 | ⚠️ RISK | Button | Nút Back là `<a href="concessions.html">` — không check booking state trước khi navigate |
| 15 | `checkout.html` | 2001–2003 | ⚠️ RISK | UX | Click overlay QR modal gọi `closeQrModal()` → HUỶ VÉ nếu user click nhầm ra ngoài |
| 16 | `checkout.html` | 1502–1530 | ⚠️ RISK | Polling | Polling gửi request dù `paymentHandled = true` → lãng phí, tiềm ẩn race condition |
| 17 | `payment-success.html` | 840–843 | ⚠️ RISK | Logic | Force reload thêm `?v=` param nếu thiếu → **infinite reload loop** nếu URL có params khác |
| 18 | `payment-success.html` | 1429–1444 | ⚠️ RISK | State | Demo fallback dùng `Math.random()` cho `bookingId` — tạo vé giả không xác thực được |
| 19 | `bookingModel.js` | 250–258 | ⚠️ LOGIC | Backend | Cả 2 nhánh `if/else` couple pair đều tính cùng `seatPrice` — code thừa, logic mơ hồ |
| 20 | `bookingController.js` | 91,116,871,889 | ⚠️ SQL | Security | SQL template literal `IN (${ids.join(',')})` — không dùng parameterized query |
| 21 | `seats.html` | 1852–1857 | ⚠️ RISK | Socket | `initSocket()` check `socket.connected` trước khi lắng nghe `connect` — miss event nếu socket chưa ready |
| 22 | `bookingRoutes.js` | 8 | ℹ️ INFO | Auth | `isCustomer` import nhưng không dùng — Admin/Manager đặt vé được |
| 23 | `checkout.html` | 2016 | ℹ️ INFO | State | `sessionStorage || localStorage` — nếu conflict, localStorage cũ override session mới |

---

## 🔴 LỖI CRASH CHI TIẾT

---

### LỖI #1 — `checkout.html` dòng 2039: Xoá storage khi `booking.completed = true`

**File:** [`checkout.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/checkout.html#L2039)

```js
if (booking.completed) {
    booking.completed = false;
    sessionStorage.removeItem('booking');   // ← XOÁ LUÔN
    localStorage.removeItem('booking');     // ← XOÁ LUÔN
    return;
}
```

**Kịch bản lỗi:**
1. User thanh toán xong → `booking.completed = true` → redirect `payment-success.html`
2. User bấm **Back** → `checkout.html` load lại → phát hiện `completed = true` → **XOÁ SẠCH storage**
3. User quay lại `payment-success.html` → không còn dữ liệu → **Demo Mode / vé giả**

> [!CAUTION]
> Đây là **root cause #1** của toàn bộ "nút bấm bị hỏng" sau thanh toán.

**Hướng tư duy:** Không nên xoá toàn bộ `booking`. Chỉ cần flag `completed` để block đặt lại. Dữ liệu hiển thị vé (`bookingId`, `movieTitle`, v.v.) cần được giữ riêng.

---

### LỖI #2 — `checkout.html` dòng 1465: `closeQrModal()` huỷ vé ngay khi user đóng modal

**File:** [`checkout.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/checkout.html#L1465)

```js
async function closeQrModal() {
    document.getElementById('qrModal').classList.remove('open');
    
    delete booking.ticketIds;          // ← XOÁ ticketIds
    delete booking.qrModalOpen;
    sessionStorage.setItem('booking', JSON.stringify(booking));
    
    // Nếu có vé đang pending, gọi API huỷ để giải phóng ghế ngay lập tức
    if (createdTicketIds && createdTicketIds.length > 0) {
        await fetch('/api/bookings/cancel', { ... ticketIds: createdTicketIds });  // ← HUỶ VÉ NGAY
        createdTicketIds = [];
    }
}
```

**Vấn đề:** Nút **X** hoặc click overlay QR modal sẽ:
1. Xoá `booking.ticketIds`
2. Gọi API `POST /api/bookings/cancel` với ticket IDs đang pending
3. Ghế bị giải phóng ngay lập tức

Nếu user **vô tình đóng modal** rồi muốn thanh toán lại → vé đã huỷ → phải tạo vé mới → có thể conflict ghế.

> [!CAUTION]
> Liên kết trực tiếp với LỖI #15: Click overlay cũng gọi `closeQrModal()`.

**Hướng tư duy:** Chỉ huỷ vé khi user **chủ động xác nhận** muốn huỷ (confirm dialog), không huỷ ngay khi đóng modal.

---

### LỖI #3 — `checkout.html` dòng 1546: Emit `leavePaymentRoom` nhưng server không có handler

**File:** [`checkout.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/checkout.html#L1546)  
**File:** [`socketManager.js`](file:///d:/SWP_FN/swp391-rbl-project-team_4/sockets/socketManager.js)

```js
// checkout.html dòng 1546-1547 — Client emit:
checkoutSocket.emit('leavePaymentRoom', ticketIds);

// socketManager.js — Không có handler nào cho 'leavePaymentRoom'!
```

**Vấn đề:** Server không có `socket.on('leavePaymentRoom', ...)`. Client emit event này sau khi xác nhận thanh toán, nhưng server không xử lý → socket vẫn ở trong payment room → tiếp tục nhận sự kiện `payment_confirmed` dù đã xử lý xong.

**Hướng tư duy:** Thêm handler `socket.on('leavePaymentRoom', ...)` trong `socketManager.js` dùng `socket.leave(room)`.

---

### LỖI #4 — `checkout.html` dòng 1550: `finalAmt` tính lại sai

**File:** [`checkout.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/checkout.html#L1550)

```js
function handlePaymentSuccess(ticketIds, meta = {}) {
    // ...
    const finalAmt = Math.max(0, (booking.totalAmount || 0) - discountAmount); // ← TÍNH LẠI
    booking.finalAmount = finalAmt;
    // ...
}
```

**Vấn đề:** Dòng 2107 trước đó đã sync được `booking.finalAmount` từ backend (qua `calculate-price`). Nhưng `handlePaymentSuccess` lại **overwrite** bằng cách tính lại phía client.

Nếu `booking.totalAmount` bị thiếu F&B (do lỗi tính toán trước đó), `finalAmt` sẽ **sai**.

**Hướng tư duy:** Ưu tiên dùng `booking.finalAmount` đã có từ backend. Chỉ fallback tính lại nếu không có.

---

### LỖI #5 — `checkout.html` dòng 1733: Countdown cứng 5 phút, không sync DB

**File:** [`checkout.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/checkout.html#L1733)

```js
let countdownSecs = 5 * 60; // 5 minutes — CỨNG
```

Có đoạn sync từ `booking.holdExpiresAt` (dòng 2019–2027), nhưng:

```js
if (booking.holdExpiresAt) {
    const rem = Math.ceil((new Date(booking.holdExpiresAt).getTime() - Date.now()) / 1000);
    if (Number.isFinite(rem) && rem > 0) {
        countdownSecs = rem;
        updateCountdown();
    } else {
        countdownSecs = 0;  // ← HẾT GIỜ NGAY nếu holdExpiresAt đã qua
        updateCountdown();   // ← Gọi ngay → disable btnPayNow ngay khi load
    }
}
```

**Vấn đề:**
1. `holdExpiresAt` được set từ thời điểm **seats.html** (dòng 2587). Từ lúc seats → concessions → checkout, có thể đã mất 1-3 phút.
2. Nếu user mở lại tab cũ sau 5 phút → `holdExpiresAt` đã qua → countdown = 0 → **vé bị "hết giờ" ngay lập tức** dù ghế DB vẫn còn lock.
3. `countdownTimer` được start ở dòng 1777 **trước** khi `DOMContentLoaded` hoàn thành (nằm trong `<script>` inline) → khởi động đếm ngược với giá trị mặc định 5 phút trong khi booking chưa được load.

**Hướng tư duy:** `countdownTimer` nên start bên trong `DOMContentLoaded`, SAU khi `booking.holdExpiresAt` được đọc và sync xong.

---

### LỖI #6 — `checkout.html` dòng 1859: `sessionId = null` gửi lên backend

**File:** [`checkout.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/checkout.html#L1859)

```js
sessionId: sessionStorage.getItem('bookingSessionId')  // ← luôn null
```

**Liên kết với Lỗi #8** (seats.html không set `bookingSessionId`). Hệ quả ở backend:

```js
// bookingModel.js dòng 227:
if (sessionId) {
    // Kiểm tra lock ownership
}
// → sessionId = null → khối if bị bỏ qua → không verify ai đang giữ ghế
```

---

### LỖI #7 — `seats.html` dòng 1741: Auth check chạy NGOÀI DOMContentLoaded

**File:** [`seats.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/seats.html#L1741)

```js
// Dòng 1741 — NẰM NGOÀI DOMContentLoaded
const token = localStorage.getItem('token') || sessionStorage.getItem('token');
if (!token) {
    alert('Vui lòng đăng nhập trước khi chọn ghế!');
    window.location.href = `auth.html?redirect=...${showtimeId}`;
    // ← Không có 'return' → code tiếp tục chạy
}

// Dòng 1750 — DOMContentLoaded vẫn chạy dù đã redirect ở trên!
document.addEventListener('DOMContentLoaded', async () => {
    // ...
    if (showtimeData && new Date(showtimeData.StartTime) < new Date()) {
        alert('Suất chiếu này đã qua.');  // ← có thể bắn sau alert auth
        window.location.replace('booking.html');
        return;
    }
```

**Vấn đề:**
1. Không có `return` sau `window.location.href` tại dòng 1744 → JavaScript tiếp tục chạy `DOMContentLoaded` **đồng thời** đang redirect
2. Nếu `showtimeId = NaN`: alert "không tìm thấy suất chiếu" (loadShowtimeDetails) + alert "vui lòng đăng nhập" → **2 popup xuất hiện liên tiếp**
3. `redirect URL` có thể chứa `showtimeId=NaN` → auth.html redirect về `seats.html?showtimeId=NaN` → **vòng lặp vô tận**

---

### LỖI #8 — `seats.html` dòng 1911: `bookingSessionId` không bao giờ được tạo

**File:** [`seats.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/seats.html#L1911)  
**File:** [`socketManager.js`](file:///d:/SWP_FN/swp391-rbl-project-team_4/sockets/socketManager.js#L12)

```js
// seats.html dòng 1911:
const sessId = sessionStorage.getItem('bookingSessionId') || '';

// socketManager.js dòng 12:
const bookingSessionId = socket.handshake.query.bookingSessionId || socket.id;
// ↑ Nếu query không có bookingSessionId → dùng socket.id — KHÁC với sessId = ''
```

**Vấn đề đầy đủ:**
1. `seats.html` KHÔNG BAO GIỜ set `bookingSessionId` vào `sessionStorage`
2. `checkout.html` kết nối socket với `query: { bookingSessionId: sessId }` (null) → server dùng `socket.id` thay thế
3. Nhưng mỗi lần reload trang, `socket.id` thay đổi → **session tracking bị mất hoàn toàn**
4. Hậu quả: `seatData.LockSessionID === sessId` luôn false → **không ghế nào được khôi phục khi Back từ concessions**
5. Hậu quả: `reclaimSeats` trên socket cũng không có tác dụng

**Hướng tư duy:** Khi user vào `seats.html`, nếu `sessionStorage.getItem('bookingSessionId')` chưa có → tạo một UUID mới (`crypto.randomUUID()` hoặc `Date.now().toString(36)`) và lưu vào `sessionStorage`. Socket kết nối với ID này.

---

### LỖI #9 — `bookingController.js` dòng 895: `getPublicBookingDetails` thiếu F&B

**File:** [`bookingController.js`](file:///d:/SWP_FN/swp391-rbl-project-team_4/controllers/bookingController.js#L895)

```js
const ticketSum = recordset.reduce((sum, item) => sum + parseFloat(item.TotalAmount || 0), 0);
const fnbSum = fnbResult.recordset.reduce(...);  // ← tính đúng

const totalAmount = ticketSum;   // ← KHÔNG CỘNG fnbSum!
```

**Ảnh hưởng:** `verify-ticket.html` và `payment-success.html` (khi load từ URL `?id=...`) đều dùng `d.totalAmount` từ API này → hiển thị sai số tiền.

So sánh: `sendGroupedBookingEmail()` dòng 121 tính đúng: `grandTotal = ticketSum + fnbSum`.

---

### LỖI #10 — `socketManager.js` dòng 108: `releaseSeat` bị ignored

**File:** [`socketManager.js`](file:///d:/SWP_FN/swp391-rbl-project-team_4/sockets/socketManager.js#L108)

```js
socket.on('releaseSeat', ({ showtimeId, seatId }) => {
    socket.emit('seatReleaseIgnored', { showtimeId, seatId, reason: 'timer_only_lock' });
    // ← Không làm gì khác. Ghế KHÔNG được giải phóng.
});
```

**Vấn đề:** Mặc dù logic "chỉ timeout mới release" có thể là design intent, nhưng:
1. Nếu user bấm Back rất nhanh trước khi timeout 5 phút → ghế vẫn bị lock cho đến khi hết timeout
2. Không có cơ chế nào cho phép user chủ động nhả ghế trước timeout (ví dụ: bấm Cancel, đóng tab)
3. Khi `closeQrModal()` (Lỗi #2) gọi API `POST /api/bookings/cancel`, ghế được cancel qua REST API — nhưng socket event `releaseSeat` từ frontend bị ignore hoàn toàn → **inconsistency giữa REST và Socket**

---

### LỖI #11 — `payment-success.html` dòng 1404: Hardcode fallback `2400` và demo data

**File:** [`payment-success.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/payment-success.html#L1404)

```js
booking = {
    movieTitle: d.movieTitle || 'DORAEMON MOVIE 45 (2026): NOBITA VÀ LÂU ĐÀI DƯỚI ĐÁY BIỂN',
    poster: (d.poster && d.poster.includes('.')) ? d.poster : 'images/doraemon_sea.png',
    seats: d.seats || 'H7, J7, J8, J9',
    finalAmount: d.totalAmount || 2400,   // ← 2400 VND???
    totalAmount: d.totalAmount || 2400,
    hall: d.roomName ? ... : 'IMAX Laser — D-CINEMA Sense City Cần Thơ',
    customerName: d.customerName || 'nmhuy',  // ← tên developer
    ...
}
```

**Vấn đề:** Khi API trả về `totalAmount = 0` hoặc `null` (vì Lỗi #9 thiếu F&B), fallback về `2400` — một con số **không có nghĩa gì** trong thực tế (lẽ ra phải là `240.000đ`?). Có thể là lỗi đánh máy (thiếu dấu phẩy).

Tên phim demo `DORAEMON...`, tên khách hàng `nmhuy`, rạp `Sense City Cần Thơ` là **dữ liệu developer còn sót lại** trong production code.

---

## ⚠️ LỖI RỦI RO / LOGIC

---

### LỖI #12 — `concessions.html` dòng 1095: Nút Continue không bị disable thật

**File:** [`concessions.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/concessions.html#L1095)

```js
if (!booking || !booking.showtimeId) {
    if (warnBanner) warnBanner.style.display = 'flex';
    const btnContinue = document.getElementById('btnContinue');
    const btnSkip = document.getElementById('btnSkip');
    if (btnContinue) btnContinue.title = 'Vui lòng chọn phim và ghế trước';
    // ← Chỉ set TITLE (tooltip), KHÔNG set disabled = true !
    // ← btnSkip cũng không được disable !
}
```

**HTML button (dòng 443):** `<button ... onclick="goToPayment()">` — không có `disabled` attribute.

**Hướng tư duy:** Cần thêm `btnContinue.disabled = true` và `btnSkip.disabled = true` khi không có booking, đồng thời thêm CSS `button:disabled { opacity: 0.5; cursor: not-allowed; }`.

---

### LỖI #13 — `concessions.html` dòng 925: Tính tiền hoàn toàn phía client

**File:** [`concessions.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/concessions.html#L925)

```js
booking.totalAmount = BASE_TICKET + fbTotal;  // ← client-side calculation
sessionStorage.setItem('booking', JSON.stringify(booking));
window.location.href = 'checkout.html';
```

**Rủi ro:** `checkout.html` có gọi `calculate-price` API để sync (dòng 2088–2122) — đây là biện pháp bảo vệ tốt. Tuy nhiên, nếu API call này fail (network error), `checkout.html` dùng `booking.totalAmount` từ client → **giá không chính xác** nhưng không có thông báo lỗi rõ ràng (chỉ `console.warn`).

---

### LỖI #14 — `checkout.html` dòng 838: Nút Back không check state trước khi navigate

**File:** [`checkout.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/checkout.html#L838)

```html
<a href="concessions.html" class="back-btn" aria-label="Quay lại">←</a>
```

**Vấn đề:** Là tag `<a>` đơn thuần, không có logic JavaScript. Khi user Back trong lúc QR modal đang mở:
1. Modal đang mở, vé đang pending payment
2. User bấm nút Back (`<a href="concessions.html">`)
3. `concessions.html` load bình thường — vé pending **không bị huỷ** (không gọi cancel API)
4. Vé pending tồn tại mãi trong DB cho đến khi timeout
5. User quay lại `checkout.html` → tạo vé mới → **có 2 set vé pending cho cùng một ghế**

**Hướng tư duy:** Thay `<a>` bằng button JavaScript, kiểm tra xem có vé pending không, nếu có thì hỏi confirm trước khi gọi cancel API rồi navigate.

---

### LỖI #15 — `checkout.html` dòng 2001: Click overlay đóng QR = Huỷ vé

**File:** [`checkout.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/checkout.html#L2001)

```js
document.getElementById('qrModal').addEventListener('click', function(e) {
    if (e.target === this) closeQrModal();  // ← Click ra ngoài = gọi closeQrModal()
});
```

Vì `closeQrModal()` huỷ vé (Lỗi #2), click **nhầm** ra ngoài modal = **HUỶ VÉ ĐANG PENDING**.

---

### LỖI #16 — `checkout.html` dòng 1510: Polling không dừng khi `paymentHandled = true`

**File:** [`checkout.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/checkout.html#L1510)

```js
checkPaymentInterval = setInterval(async () => {
    if (paymentHandled) { clearInterval(checkPaymentInterval); return; }
    // ...
}, 3000);
```

**Vấn đề:** Khi `paymentHandled = true`, code vẫn vào callback 1 lần (để check điều kiện) rồi mới clear. Nếu Socket và Polling **đồng thời** nhận xác nhận:
1. Socket callback chạy → `paymentHandled = true` → `handlePaymentSuccess()` lần 1
2. Polling callback đang chờ response từ server → response về → check `paymentHandled` → đã true → return — **OK**

Nhưng nếu polling đã bắt đầu send request TRƯỚC khi socket set `paymentHandled = true` → cả 2 có thể gọi `handlePaymentSuccess()`. Hàm có guard `if (paymentHandled) return` nhưng **có thể có race condition** giữa 2 async contexts.

---

### LỖI #17 — `payment-success.html` dòng 840: Infinite reload loop

**File:** [`payment-success.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/payment-success.html#L840)

```js
if (!window.location.search.includes('v=')) {
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now());
    window.location.replace(url.toString());  // ← Reload với ?v=xxx
}
```

**Vấn đề:** Nếu URL đã có `?id=123` nhưng không có `?v=`, đoạn code này sẽ add `?v=` và reload → OK.  
Nhưng nếu URL có `?id=123&v=xxx` → không reload → ổn.

Tuy nhiên, hàm `handlePaymentSuccess` ở checkout.html redirect sang `payment-success.html?v=` + `Date.now()`. Khi `payment-success.html` check `?v=` → có → không reload → ổn.

**Nguy cơ thực tế:** Nếu ai đó navigate vào `payment-success.html` với URL `?id=123&someOtherParam=abc` nhưng không có `?v=` → reload → `?id=123&someOtherParam=abc&v=xxx` → OK, chỉ reload 1 lần.

**Nguy cơ thực tế hơn:** Code này chạy **TRƯỚC** `DOMContentLoaded` → nếu reload xảy ra, toàn bộ init logic bị interrupt giữa chừng.

---

### LỖI #18 — `payment-success.html` dòng 1440: Demo Mode dùng `Math.random()` bookingId

**File:** [`payment-success.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/payment-success.html#L1440)

```js
bookingId: 'DC-' + Math.floor(1000000 + Math.random() * 9000000),
```

Nếu không có booking state → Demo Mode → `bookingId` là số random → `verify-ticket.html?id=<random>` → API trả về 404 → user thấy "Không tìm thấy vé". **Không bao giờ show lỗi rõ ràng.**

---

### LỖI #19 — `bookingModel.js` dòng 250: Couple seat if/else logic thừa

**File:** [`bookingModel.js`](file:///d:/SWP_FN/swp391-rbl-project-team_4/models/bookingModel.js#L250)

```js
if (!couplePairsCharged.has(pairKey)) {
    couplePairsCharged.add(pairKey);
    seatPrice = ticketPrice * halfMult;   // ← nhánh 1
} else {
    seatPrice = ticketPrice * halfMult;   // ← nhánh 2 — GIỐNG HỆT nhánh 1
}
```

Logic đã đúng (mỗi ghế trong cặp tính `halfMult`) nhưng code rất misleading. Cần làm rõ ý định.

---

### LỖI #20 — `bookingController.js`: SQL template literal

**File:** [`bookingController.js`](file:///d:/SWP_FN/swp391-rbl-project-team_4/controllers/bookingController.js#L91)  
**Dòng:** 91, 116, 871, 889

```js
WHERE t.TicketID IN (${ids.join(',')})  // ← Template literal, không parameterized
```

Mặc dù `ids` đã qua `parseInt()`, pattern này vẫn nguy hiểm và không follow best practice.

---

### LỖI #21 — `seats.html` dòng 1852: `initSocket()` check `connected` trước khi lắng nghe `connect`

**File:** [`seats.html`](file:///d:/SWP_FN/swp391-rbl-project-team_4/public/seats.html#L1851)

```js
function initSocket() {
    if (socket.connected) {
        socket.emit('joinShowtime', showtimeId);  // ← Chỉ emit nếu đã connected
    }
    socket.on('connect', () => {
        socket.emit('joinShowtime', showtimeId);  // ← Lắng nghe event connect để emit
    });
    // ...
}
```

**Vấn đề nhỏ:** Socket.IO JavaScript client mặc định kết nối tự động (`autoConnect: true`). Khi `initSocket()` được gọi, socket **thường chưa connect** (async) → `socket.connected` = false → không emit ngay.

Điều này ổn vì có `socket.on('connect', ...)`. Nhưng nếu socket đã connected (ví dụ reload trang nhanh, socket reconnect trước initSocket) → `connect` event không fire lại → cần check `socket.connected` sau khi đăng ký listener.

Thứ tự logic hơi ngược: nên đăng ký `socket.on('connect')` TRƯỚC, rồi check `socket.connected` để emit ngay nếu đã sẵn sàng.

---

## 🎯 Sơ Đồ Root Cause

```
┌─────────────────────────────────────────────────────────────────┐
│  MẤT DỮ LIỆU BOOKING (Root Cause Group A)                      │
│                                                                 │
│  #1 checkout.html xoá storage khi completed=true              │
│      → payment-success.html mất dữ liệu → Demo Mode           │
│                                                                 │
│  #8 bookingSessionId không được tạo                           │
│      → sessId = '' → khôi phục ghế khi Back LUÔN THẤT BẠI    │
│      → #6 sessionId=null gửi backend → skip lock check        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  HUỶ VÉ NGOÀI Ý MUỐN (Root Cause Group B)                     │
│                                                                 │
│  #2 closeQrModal() gọi API cancel ngay                        │
│      → #15 click overlay = huỷ vé                             │
│      → #14 Back button không check pending ticket             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TIỀN HIỂN THỊ SAI (Root Cause Group C)                        │
│                                                                 │
│  #9 getPublicBookingDetails thiếu fnbSum                      │
│      → #11 payment-success hiển thị tiền sai / fallback 2400 │
│      → verify-ticket.html cũng sai                           │
│                                                                 │
│  #4 handlePaymentSuccess tính lại finalAmt phía client        │
│      → bỏ qua backend finalAmount đã sync                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  REALTIME SOCKET LỖI (Root Cause Group D)                      │
│                                                                 │
│  #3 leavePaymentRoom không có server handler                  │
│  #10 releaseSeat bị ignored — không thể nhả ghế manual       │
│  #21 initSocket() thứ tự logic connected check ngược          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  COUNTDOWN / TIMER LỖI (Root Cause Group E)                    │
│                                                                 │
│  #5 countdownTimer start trước DOMContentLoaded               │
│      → đếm với giá trị 5 phút mặc định, sau đó mới sync      │
│      → nếu holdExpiresAt đã qua → disable Pay Now ngay       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💡 Thứ Tự Ưu Tiên Sửa (Priority Order)

| Priority | Lỗi | Lý do |
|---|---|---|
| **P0** | #1, #8 | Root cause của toàn bộ luồng bị hỏng |
| **P0** | #2, #15 | Huỷ vé ngoài ý muốn — UX thảm họa |
| **P1** | #6, #9 | Session ID null và tiền sai trên vé |
| **P1** | #3, #10 | Socket handler thiếu |
| **P2** | #4, #5, #7 | Logic timer/finalAmount/auth |
| **P2** | #11, #12, #14 | UX fallback/disable button |
| **P3** | #13, #16–#21 | Cải thiện độ bền và bảo mật |

---

## 🔧 Hướng Tư Duy Tổng Hợp (KHÔNG phải code)

1. **Tạo `bookingSessionId`** ngay khi user vào `seats.html` bằng cách dùng `crypto.randomUUID()`, lưu vào `sessionStorage` và truyền khi kết nối Socket.IO.

2. **Tách "flag đã đặt xong" ra khỏi "dữ liệu hiển thị vé"**: Thay vì xoá toàn bộ `booking` object, dùng key riêng ví dụ `completedBookingId` để đánh dấu, giữ nguyên `booking` cho `payment-success.html` đọc.

3. **`closeQrModal()` không nên tự động huỷ vé**: Chỉ clear UI, không gọi cancel API. Cần có nút "Huỷ đặt vé" riêng để user xác nhận.

4. **Thêm server handler `leavePaymentRoom`** trong `socketManager.js` để socket rời room sau khi thanh toán xong.

5. **`getPublicBookingDetails` cộng thêm `fnbSum`** vào `totalAmount` — xem cách hàm `sendGroupedBookingEmail` tính `grandTotal` để làm tương tự.

6. **`countdownTimer` phải start bên trong `DOMContentLoaded`** sau khi đọc xong `booking.holdExpiresAt`.

7. **Nút Back ở `checkout.html`** phải check `createdTicketIds.length > 0` và hiển thị confirm dialog trước khi navigate sang `concessions.html`.

8. **Xoá toàn bộ hardcode demo data** (`DORAEMON`, `nmhuy`, `H7, J7, J8, J9`, `2400`, `Sense City Cần Thơ`) khỏi `payment-success.html`.

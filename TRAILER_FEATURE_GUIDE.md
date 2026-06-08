# Hướng Dẫn Tính Năng Trailer

## Tổng Quan

Tính năng trailer cho phép quản lý viên thêm link trailer YouTube vào cơ sở dữ liệu phim, và người dùng có thể xem trailer trên trang chi tiết phim.

---

## 1. Database Schema

**Bảng Movies** đã có cột `TrailerURL` để lưu link trailer:

```sql
CREATE TABLE Movies (
    MovieID     INT IDENTITY(1,1) PRIMARY KEY,
    Title       NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX),
    Director    NVARCHAR(100),
    Duration    INT NOT NULL,
    AgeRating   VARCHAR(10),
    TrailerURL  VARCHAR(255),           -- ← Link trailer YouTube
    PosterURL   VARCHAR(255),
    Status      VARCHAR(50),
    MainCast    NVARCHAR(MAX)
);
```

---

## 2. Thêm Trailer Qua Admin Panel

### Bước 1: Mở Admin Dashboard

- Vào trang admin (`/admin.html` hoặc `/public/admin.html`)
- Đăng nhập với tài khoản Admin/Manager
- Click vào menu **"Movies"**

### Bước 2: Click "Add Movie"

- Nhấn nút **"Add Movie"** ở góc trên phải
- Modal form sẽ xuất hiện

### Bước 3: Điền thông tin phim

Form có các trường sau:

- **POSTER UPLOAD**: Upload hình poster phim
- **MOVIE TITLE**: Tên phim (bắt buộc)
- **SYNOPSIS**: Mô tả phim
- **DIRECTOR**: Tên đạo diễn
- **STATUS**: Tình trạng (Now Showing / Coming Soon)
- **CAST**: Diễn viên (tách bằng dấu phẩy)
- **DURATION**: Thời lượng phim tính bằng phút (bắt buộc)
- **AGE RATING**: Phân loại độ tuổi (P, C13, C16, C18)
- **TRAILER URL**: Link trailer YouTube (mới thêm) ← **QUAN TRỌNG**

### Bước 4: Nhập YouTube Trailer URL

Có **3 định dạng URL YouTube được hỗ trợ**:

#### 1️⃣ Embed URL (Cách tốt nhất - dùng trực tiếp)

```
https://www.youtube.com/embed/drcWuhD1Xb4
```

Sao chép từ YouTube → **Share** → **Embed** → Lấy URL trong thẻ `<iframe src="...">`

#### 2️⃣ Watch URL

```
https://www.youtube.com/watch?v=drcWuhD1Xb4
```

Copy từ thanh địa chỉ khi xem video

#### 3️⃣ Short URL

```
https://youtu.be/drcWuhD1Xb4
```

Share link rút gọn từ YouTube

**Tất cả 3 định dạng trên sẽ được chuyển đổi thành embed URL tự động.**

### Bước 5: Click "Save Movie"

- Hệ thống sẽ lưu phim vào database
- Trailer URL sẽ được lưu vào cột `TrailerURL`

---

## 3. Xem Trailer Trên Web

### Trang Home (index.html)

- Danh sách phim sẽ hiển thị
- Hover vào poster phim → Xuất hiện button **"Xem Trailer"**
- Click để mở modal video xem trailer

### Trang Chi Tiết Phim (movie-detail.html)

- Khi click vào phim để xem chi tiết
- Ở phần hero section xuất hiện 2 nút:
  - **"Mua vé"** - Chuyển đến trang đặt vé
  - **"Xem Trailer"** ← Click để xem trailer

### Cách Xem Trailer

1. Click nút **"Xem Trailer"**
2. Modal video sẽ xuất hiện kích thước lớn
3. Video YouTube embed sẽ tự động load
4. Click **X** ở góc trên phải hoặc click ngoài modal để đóng

---

## 4. API Endpoints

### Thêm Phim (Với Trailer)

```
POST /api/admin/movies
Authorization: Bearer <token>
Content-Type: application/json

{
    "title": "Dune: Hành Tinh Cát - Phần 2",
    "description": "Paul Atreides...",
    "director": "Denis Villeneuve",
    "duration": 166,
    "ageRating": "C13",
    "trailerURL": "https://www.youtube.com/embed/Way9Dexny3w",
    "mainCast": "Timothée Chalamet, Zendaya",
    "status": "now-showing",
    "genre": "Action",
    "releaseDate": "2026-05-20"
}
```

### Lấy Chi Tiết Phim (Bao Gồm Trailer)

```
GET /api/movies/:movieId

Response:
{
    "success": true,
    "data": {
        "MovieID": 7,
        "Title": "Dune: Hành Tinh Cát - Phần 2",
        "Description": "...",
        "Duration": 166,
        "AgeRating": "C13",
        "TrailerURL": "https://www.youtube.com/embed/Way9Dexny3w",
        "PosterURL": "...",
        "Genre": "Action, Sci-Fi"
    }
}
```

### Cập Nhật Trailer Phim

```
PUT /api/admin/movies/:movieId
Authorization: Bearer <token>
Content-Type: application/json

{
    "trailerURL": "https://www.youtube.com/embed/NEW_VIDEO_ID"
}
```

---

## 5. Xem Dữ Liệu Trailer Trong Database

### SQL Query

```sql
SELECT MovieID, Title, TrailerURL, Status
FROM Movies
WHERE TrailerURL IS NOT NULL
ORDER BY MovieID DESC;
```

### Kiểm Tra Movie Detail

```sql
SELECT MovieID, Title, Duration, AgeRating, TrailerURL, Status
FROM Movies
WHERE MovieID = 7;
```

---

## 6. Troubleshooting

### ❌ Trailer không hiển thị

1. Kiểm tra URL YouTube có đúng định dạng không
   - Nếu là `watch?v=ID` → Hệ thống sẽ tự động chuyển thành `embed/ID`
   - Nếu là `youtu.be/ID` → Hệ thống sẽ tự động chuyển thành `embed/ID`
2. Kiểm tra video YouTube có **cho phép embed** không (Settings → Advanced Settings)
3. Kiểm tra database xem `TrailerURL` có được lưu không

### ❌ Modal video không hiện

1. Kiểm tra browser console để xem lỗi gì
2. Đảm bảo `trailerModal` và `trailerIframe` có trong HTML

### ❌ API trả về lỗi 401 (Unauthorized)

1. Kiểm tra token admin có hợp lệ không
2. Đảm bảo có đăng nhập admin trước khi thêm phim

---

## 7. JavaScript Functions

### Frontend (movie-detail.html)

```javascript
// Mở modal trailer
function openTrailer() {
  const modal = document.getElementById("trailerModal");
  const iframe = document.getElementById("trailerIframe");
  iframe.src = currentTrailerUrl;
  modal.classList.add("show");
}

// Đóng modal trailer
function closeTrailer() {
  const modal = document.getElementById("trailerModal");
  const iframe = document.getElementById("trailerIframe");
  iframe.src = "";
  modal.classList.remove("show");
}

// Chuyển đổi YouTube URL thành embed URL
function getEmbedUrl(url) {
  if (!url) return "";
  if (url.includes("youtube.com/embed/")) return url;

  let videoId = "";
  if (url.includes("youtube.com/watch")) {
    const urlParams = new URLSearchParams(new URL(url).search);
    videoId = urlParams.get("v");
  } else if (url.includes("youtu.be/")) {
    videoId = url.split("youtu.be/")[1].split("?")[0];
  }
  return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
}
```

### Admin Panel (admin.html)

```javascript
// Lưu phim với trailer URL
function saveMovie() {
    const trailerURL = document.getElementById('movieTrailerURL').value;

    const movieData = {
        title: /* ... */,
        trailerURL: trailerURL || null,
        // ... other fields
    };

    fetch('/api/admin/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movieData)
    });
}
```

---

## 8. Ví Dụ Dữ Liệu

### Danh Sách Trailer YouTube Có Sẵn

```
• Dune Part 2: https://www.youtube.com/embed/Way9Dexny3w
• Deadpool & Wolverine: https://www.youtube.com/embed/73_1biulkIE
• Doraemon Orchestra: https://www.youtube.com/embed/drcWuhD1Xb4
• Oppenheimer: https://www.youtube.com/embed/uYPbbEsQ21A
```

---

## 9. Kiểm Tra Hoàn Chỉnh ✅

### Checklist Tính Năng Trailer

- [x] Database schema có cột `TrailerURL`
- [x] Admin form có input field **"TRAILER URL"**
- [x] saveMovie() function gửi trailerURL lên API
- [x] `/api/admin/movies` POST endpoint xử lý trailerURL
- [x] AdminModel.createMovie() lưu trailerURL vào database
- [x] MovieModel.getMovieById() SELECT trailerURL
- [x] movie-detail.html load trailerURL từ API
- [x] openTrailer() function hiển thị video trong modal
- [x] getEmbedUrl() xử lý nhiều định dạng YouTube URL
- [x] Modal video có nút đóng
- [x] seed_movies.js có sample trailer URLs

---

**Công nghệ sử dụng:**

- YouTube Embed API
- HTML5 iframe
- JavaScript fetch API
- SQL Server (TrailerURL column)
- Node.js / Express (API endpoint)

**Cập nhật lần cuối:** June 3, 2026

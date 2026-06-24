# Hướng dẫn Nén & Chạy Dự án CinemaVerse

Tài liệu này hướng dẫn chi tiết cách chuẩn bị cơ sở dữ liệu, đóng gói dự án gửi cho bạn bè, và các bước cài đặt để chạy dự án trên máy mới.

---

## PHẦN 1: DÀNH CHO BẠN (Người chuẩn bị và gửi file ZIP)

### Bước 1: Xuất CSDL SQL Server thành file script `.sql`
Để bạn của bạn có đầy đủ dữ liệu phòng chiếu, lịch chiếu, phim, người dùng và sơ đồ ghế quy chuẩn mới:
1. Mở **SQL Server Management Studio (SSMS)** và kết nối với CSDL SQL Server của bạn.
2. Click chuột phải vào Database **`CinemaManagement`** -> Chọn **Tasks** -> Chọn **Generate Scripts...**
3. Trong bảng hiện ra, nhấn **Next**. Tại bước chọn đối tượng, giữ mặc định **"Script entire database and all database objects"** -> Nhấn **Next**.
4. Tại bước thiết lập File đầu ra:
   * Nhấp vào nút **Advanced** ở góc trên bên phải.
   * Tìm đến dòng **"Types of data to script"** (Mặc định là *Schema only*).
   * Đổi giá trị này thành **"Schema and data"** (Đây là bước tối quan trọng để xuất kèm dữ liệu mẫu của các bảng!).
   * Nhấn **OK** để đóng bảng Advanced.
5. Chọn lưu thành một file đơn (Single file), đặt tên là **`database_seed.sql`** và lưu trực tiếp vào thư mục gốc của dự án.
6. Nhấn **Next** -> **Next** -> Đợi chạy xong rồi nhấn **Finish**.

### Bước 2: Nén dự án thành file ZIP
Khi nén thư mục dự án để gửi, **bắt buộc loại bỏ** các thư mục sau để giảm dung lượng file ZIP (từ vài trăm MB xuống chỉ còn vài MB):
1. **`node_modules`**: Thư mục chứa các thư viện tải về (Người nhận sẽ tự khôi phục bằng lệnh `npm install` rất nhanh).
2. Thư mục ẩn **`.git`** hoặc các thư mục logs/scratch không cần thiết nếu có.

*Sau khi loại bỏ, click chuột phải vào thư mục dự án `swp391-rbl-project-team_4` và chọn **Compress to ZIP file**.*

---

## PHẦN 2: DÀNH CHO BẠN CỦA BẠN (Người nhận file ZIP và cài đặt)

Sau khi giải nén file ZIP nhận được, hãy thực hiện các bước sau để chạy dự án:

### Bước 1: Cài đặt các công cụ cần thiết (Prerequisites)
1. Tải và cài đặt **Node.js** (Khuyên dùng bản LTS mới nhất): https://nodejs.org/
2. Tải và cài đặt **Microsoft SQL Server** (Bản Express/Developer): https://www.microsoft.com/en-us/sql-server/sql-server-downloads
3. Tải và cài đặt **SQL Server Management Studio (SSMS)**: https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms

### Bước 2: Tạo và Khôi phục Cơ sở dữ liệu
1. Mở **SSMS** và kết nối vào Server local của bạn.
2. Nhấn vào **File** -> **Open** -> **File...** -> Chọn tệp **`database_seed.sql`** nằm trong thư mục dự án vừa giải nén.
3. Nhấn **Execute** (hoặc phím **F5**) trên thanh công cụ để chạy toàn bộ mã script SQL. Script này sẽ tự động tạo cơ sở dữ liệu `CinemaManagement`, tạo toàn bộ bảng cấu trúc và chèn đầy đủ dữ liệu mẫu (Sơ đồ ghế mới, Suất chiếu, Phim, Tài khoản).

### Bước 3: Cài đặt các gói thư viện (Dependencies)
1. Mở Terminal / Command Prompt (CMD) hoặc PowerShell trên máy tính của bạn.
2. Di chuyển (cd) vào thư mục dự án vừa giải nén.
3. Chạy lệnh sau để tải và cài đặt toàn bộ thư viện cần thiết:
   ```bash
   npm install
   ```

### Bước 4: Cấu hình biến môi trường
1. Tìm file **`.env`** ở thư mục gốc dự án.
2. Mở file bằng Notepad hoặc VS Code. Nếu thông tin tài khoản SQL Server của bạn khác với thông tin mặc định, hãy bỏ dấu `#` và cập nhật các dòng cấu hình sau cho khớp:
   ```env
   # --- CẤU HÌNH CƠ SỞ DỮ LIỆU SQL SERVER ---
   DB_USER=sa              # Tên đăng nhập SQL Server của bạn (mặc định sa)
   DB_PASSWORD=123456      # Mật khẩu kết nối SQL Server của bạn
   DB_SERVER=localhost     # Địa chỉ server (mặc định localhost)
   DB_PORT=1433            # Port kết nối (mặc định 1433)
   DB_DATABASE=CinemaManagement
   ```

### Bước 5: Khởi chạy dự án
1. Tại Terminal/CMD đang mở ở thư mục dự án, chạy lệnh:
   ```bash
   npm start
   ```
2. Đợi terminal hiển thị dòng chữ:
   `🎬 CinemaVerse Server đang chạy tại http://localhost:9999`
3. Mở trình duyệt Web (Chrome, Edge, Cốc Cốc...) và truy cập địa chỉ:
   **`http://localhost:9999`** để trải nghiệm dự án!

---
*Lưu ý: Dự án đã được cấu hình giả lập thanh toán tự động qua SePay tại đường dẫn [http://localhost:9999/mock-payment-gateway.html](http://localhost:9999/mock-payment-gateway.html) để bạn có thể test luồng mua vé & quét mã QR xác nhận tiền về tự động ở môi trường local.*

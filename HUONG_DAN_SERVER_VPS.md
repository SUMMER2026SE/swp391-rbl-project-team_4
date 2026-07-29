# Hướng Dẫn Quản Trị & Cập Nhật Website Trên VPS Server (`dcinema.io.vn`)

Tài liệu này lưu trữ thông tin đăng nhập máy chủ VPS và bộ câu lệnh chuẩn để bạn có thể kết nối, cập nhật code mới nhất từ Git và khởi động lại website bất cứ lúc nào.

---

## 1. Thông Tin Máy Chủ VPS
* **IP Server:** `180.93.33.96`
* **Port SSH:** `22`
* **Username:** `root`
* **Password Root:** `NdOuHWt2HYJthtTt`

---

## 2. Cách Kết Nối Vào VPS Từ Máy Windows Cá Nhân
1. Mở **Command Prompt (CMD)** hoặc **PowerShell** trên máy tính Windows của bạn.
2. Nhập câu lệnh kết nối SSH:
   ```cmd
   ssh root@180.93.33.96
   ```
3. Khi terminal hỏi `root@180.93.33.96's password:`, bạn copy mật khẩu dưới đây:
   ```text
   NdOuHWt2HYJthtTt
   ```
   *⚠️ **Lưu ý quan trọng:** Khi paste (chuột phải) hoặc gõ mật khẩu vào terminal SSH, màn hình sẽ **không hiển thị dấu sao `***` hay bất kỳ ký tự nào** vì lý do bảo mật. Bạn cứ gõ/paste đúng mật khẩu rồi nhấn **Enter** là sẽ đăng nhập thành công.*

---

## 3. Bộ Lệnh Cập Nhật Code Mới Nhất & Khởi Động Lại Server
Ngay sau khi đăng nhập thành công (màn hình hiển thị `root@linux7891:~#`), bạn copy và chạy lần lượt 3 lệnh sau:

```bash
# 1. Di chuyển vào thư mục dự án
cd ~/swp391-rbl-project-team_4

# 2. Kéo code mới nhất từ GitHub về
git pull

# 3. Khởi động lại toàn bộ dịch vụ web (PM2)
pm2 restart all
```

Sau khi thấy PM2 hiển thị bảng trạng thái màu xanh chữ **`online`**, bạn vào trình duyệt mở trang web (`dcinema.io.vn`), ấn **Ctrl + F5** (hoặc Cmd + Shift + R) để xóa cache là các thay đổi mới nhất sẽ hiển thị!

---

## 4. Các Câu Lệnh Quản Trị Nâng Cao (Khi Cần Kiểm Tra Lỗi)
* **Xem trạng thái Server:**
  ```bash
  pm2 status
  ```
* **Xem logs trực tiếp của Web Server (để theo dõi lỗi):**
  ```bash
  pm2 logs
  ```
* **Nếu có cài thêm thư viện mới (package.json thay đổi), chạy thêm:**
  ```bash
  npm install
  pm2 restart all
  ```

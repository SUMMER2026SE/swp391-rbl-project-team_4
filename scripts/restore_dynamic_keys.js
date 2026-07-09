const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, 'public/locales/en.json');
const viPath = path.join(__dirname, 'public/locales/vi.json');

const enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const viDict = JSON.parse(fs.readFileSync(viPath, 'utf8'));

if (!enDict.admin) enDict.admin = {};
if (!viDict.admin) viDict.admin = {};

const dynamicKeys = {
    "no_rooms": { vi: "Không có phòng chiếu", en: "No rooms available" },
    "no_schedule": { vi: "Chưa có lịch chiếu", en: "No showtimes scheduled" },
    "all_cinemas": { vi: "Tất cả cụm rạp", en: "All Cinemas" },
    "today_caps": { vi: "HÔM NAY", en: "TODAY" },
    "now_showing": { vi: "Đang chiếu", en: "Now Showing" },
    "coming_soon": { vi: "Sắp chiếu", en: "Coming Soon" },
    "deleted": { vi: "Đã xóa", en: "Deleted" },
    "dir": { vi: "ĐĐ.", en: "Dir." },
    "updating": { vi: "Đang cập nhật", en: "Updating" },
    "unassigned": { vi: "Chưa gán", en: "Unassigned" },
    "minutes": { vi: "phút", en: "minutes" },
    "edit_movie": { vi: "Sửa Phim", en: "Edit Movie" },
    "update_movie": { vi: "Cập nhật phim", en: "Update Movie" },
    "add_new_movie": { vi: "THÊM PHIM MỚI", en: "ADD NEW MOVIE" },
    "save_movie": { vi: "Lưu Phim", en: "Save Movie" },
    "featured": { vi: "Nổi bật", en: "Featured" },
    "price_caps": { vi: "GIÁ", en: "PRICE" },
    "stock_caps": { vi: "TỒN KHO", en: "STOCK" },
    "stock_med": { vi: "Trung bình", en: "Medium" },
    "units": { vi: "đơn vị", en: "units" },
    "active_caps": { vi: "HOẠT ĐỘNG", en: "ACTIVE" },
    "suspended_caps": { vi: "BỊ KHÓA", en: "SUSPENDED" },
    "authorized_persons": { vi: "người được cấp quyền", en: "authorized personnel" },
    "customers": { vi: "khách hàng", en: "customers" },
    "active": { vi: "Hoạt động", en: "Active" },
    "locked": { vi: "Đã khóa", en: "Locked" },
    "showing": { vi: "Hiển thị", en: "Showing" },
    "staff_lowercase": { vi: "nhân viên", en: "staff" },
    "city_placeholder": { vi: "-- Chọn thành phố --", en: "-- Select city --" },
    "branch_placeholder": { vi: "-- Chọn rạp / chi nhánh --", en: "-- Select branch --" },
    "select_city": { vi: "Chọn thành phố", en: "Select city" },
    "select_room": { vi: "Chọn phòng", en: "Select room" },
    "no_showtimes_today": { vi: "Chưa có suất chiếu nào trong ngày này.", en: "No showtimes for this day." },
    "cinema_room": { vi: "Rạp / Phòng", en: "Cinema / Room" },
    "ticket_price": { vi: "Giá vé", en: "Ticket Price" },
    "cancelled": { vi: "Đã hủy", en: "Cancelled" },
    "finished": { vi: "Đã kết thúc", en: "Finished" },
    "seats_lowercase": { vi: "ghế", en: "seats" },
    "duration": { vi: "Thời lượng", en: "Duration" },
    "rooms": { vi: "Phòng", en: "Rooms" },
    "seats": { vi: "Ghế", en: "Seats" },
    "no_rooms_short": { vi: "Không có phòng", en: "No rooms" },
    "cinema_branch": { vi: "CỤM RẠP", en: "CINEMA BRANCH" },
    "edit_cinema": { vi: "Sửa Rạp", en: "Edit Cinema" },
    "delete_cinema": { vi: "Xóa Rạp", en: "Delete Cinema" },
    "room_list": { vi: "DANH SÁCH PHÒNG CHIẾU", en: "ROOM LIST" },
    "add_room": { vi: "Thêm phòng", en: "Add Room" },
    "capacity": { vi: "Sức chứa", en: "Capacity" },
    "edit_name": { vi: "Sửa tên", en: "Edit name" },
    "delete": { vi: "Xóa", en: "Delete" },
    "no_rooms_created": { vi: "Chưa có phòng chiếu nào được tạo.", en: "No rooms have been created." },
    "stats_info": { vi: "THÔNG SỐ", en: "STATISTICS" },
    "total_rooms": { vi: "Tổng số phòng", en: "Total rooms" },
    "total_seats": { vi: "Tổng số ghế", en: "Total seats" },
    "city": { vi: "Thành phố", en: "City" },
    "loading_seatmap": { vi: "Đang tải sơ đồ ghế...", en: "Loading seat map..." },
    "add_room_new": { vi: "Thêm phòng chiếu mới", en: "Add new room" },
    "edit_room_name": { vi: "Sửa tên phòng chiếu", en: "Edit room name" },
    "total_seats_lc": { vi: "Tổng ghế", en: "Total seats" },
    "no_seat_selected": { vi: "Chưa chọn ghế", en: "No seat selected" },
    "no_seat_data": { vi: "Không có dữ liệu ghế.", en: "No seat data." },
    "no_posts": { vi: "Chưa có bài viết nào.", en: "No posts available." },
    "normal": { vi: "Thường", en: "Normal" },
    "no_promos": { vi: "Chưa có khuyến mãi nào.", en: "No promotions available." }
};

Object.keys(dynamicKeys).forEach(key => {
    enDict.admin[key] = dynamicKeys[key].en;
    viDict.admin[key] = dynamicKeys[key].vi;
});

fs.writeFileSync(enPath, JSON.stringify(enDict, null, 4), 'utf8');
fs.writeFileSync(viPath, JSON.stringify(viDict, null, 4), 'utf8');

console.log('Restored all dynamic keys into dictionaries!');

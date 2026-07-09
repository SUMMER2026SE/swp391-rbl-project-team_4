const fs = require('fs');
const path = require('path');

const viPath = path.join(__dirname, 'public/locales/vi.json');
const viDict = JSON.parse(fs.readFileSync(viPath, 'utf8'));

viDict.admin.live_status = "Trạng thái Trực tiếp";
viDict.admin.z5t42a = "Thêm Phim";
viDict.admin.uoiopq = "Thư viện Phim";
viDict.admin.ql9ivd = "Lưu Phim";
viDict.admin.e0m1un = "Quyền Quản trị";
viDict.admin.badge = "NHÃN NỔI BẬT";

// Also fix any potential database-related English words IF they were hardcoded, but "Standard" is from DB so we shouldn't translate DB names via JSON unless we map them.
// Let's add mapping for "Standard" and "Sweetbox" just in case they are used in data-i18n-suffix.
viDict.admin.room_standard = "Tiêu chuẩn";
viDict.admin.room_sweetbox = "Ghế đôi (Sweetbox)";

fs.writeFileSync(viPath, JSON.stringify(viDict, null, 4), 'utf8');
console.log("Fixed Vietnamese localization");

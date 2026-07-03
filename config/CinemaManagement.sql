-- Xóa database cũ nếu đã tồn tại
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'CinemaManagement')
BEGIN
    ALTER DATABASE CinemaManagement SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE CinemaManagement;
END
GO
CREATE DATABASE CinemaManagement;
GO
USE CinemaManagement;
GO
-- ===========================================================================
-- PHẦN 1: TÀI KHOẢN VÀ PHÂN QUYỀN
-- ===========================================================================
-- 1. BẢNG PHÂN QUYỀN
CREATE TABLE Roles (
    RoleID   INT IDENTITY(1,1) PRIMARY KEY,
    RoleName VARCHAR(50) NOT NULL UNIQUE
);
-- 2. BẢNG NGƯỜI DÙNG
CREATE TABLE Users (
    UserID       INT IDENTITY(1,1) PRIMARY KEY,
    RoleID       INT NOT NULL,
    FullName     NVARCHAR(100) NOT NULL,
    Email        VARCHAR(100) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Phone        VARCHAR(15),
    IsActive     BIT DEFAULT 1,
    DOB          DATE NULL,
    Address      NVARCHAR(255) NULL,
    RewardPoints INT DEFAULT 0,
    AvatarURL    NVARCHAR(500) NULL,
    CreatedAt    DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (RoleID) REFERENCES Roles(RoleID)
);
-- 3. BẢNG OTP QUÊN MẬT KHẨU
CREATE TABLE PasswordResets (
    ResetID   INT IDENTITY(1,1) PRIMARY KEY,
    UserID    INT NOT NULL,
    OTPHash   VARCHAR(255) NOT NULL,
    ExpiresAt DATETIME NOT NULL,
    IsUsed    BIT DEFAULT 0,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);
CREATE INDEX IX_PasswordResets_UserID ON PasswordResets(UserID, IsUsed, ExpiresAt);
GO
-- ===========================================================================
-- PHẦN 2: QUẢN LÝ RẠP VÀ PHÒNG CHIẾU
-- ===========================================================================
-- 4. BẢNG CỤM RẠP
--    Cột chính: CinemaName (backend gọi c.CinemaName)
--    Cột computed: Name (backend adminModel.getRecentTransactions gọi c.Name)
CREATE TABLE Cinemas (
    CinemaID   INT IDENTITY(1,1) PRIMARY KEY,
    CinemaName NVARCHAR(100) NOT NULL,
    Name       AS (CinemaName),               -- Computed column = CinemaName
    Address    NVARCHAR(255) NOT NULL,
    City       NVARCHAR(50) NOT NULL
);
-- 5. BẢNG PHÒNG CHIẾU
CREATE TABLE Rooms (
    RoomID     INT IDENTITY(1,1) PRIMARY KEY,
    CinemaID   INT NOT NULL,
    RoomName   NVARCHAR(50) NOT NULL,
    TotalSeats INT NOT NULL,
    FOREIGN KEY (CinemaID) REFERENCES Cinemas(CinemaID)
);
-- 6. BẢNG SƠ ĐỒ GHẾ NGỒI
CREATE TABLE Seats (
    SeatID          INT IDENTITY(1,1) PRIMARY KEY,
    RoomID          INT NOT NULL,
    SeatRow         VARCHAR(5) NOT NULL,
    SeatNumber      INT NOT NULL,
    SeatType        VARCHAR(20) DEFAULT 'Normal',   -- Normal, VIP, Couple
    PriceMultiplier DECIMAL(5,2) DEFAULT 1.0,
    FOREIGN KEY (RoomID) REFERENCES Rooms(RoomID)
);
GO
-- ===========================================================================
-- PHẦN 3: QUẢN LÝ PHIM VÀ LỊCH CHIẾU
-- ===========================================================================
-- 7. BẢNG PHIM
CREATE TABLE Movies (
    MovieID     INT IDENTITY(1,1) PRIMARY KEY,
    Title       NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX),
    Director    NVARCHAR(100),
    Duration    INT NOT NULL,                       -- Phút
    AgeRating   VARCHAR(10),                        -- P, C13, C16, C18
    TrailerURL  VARCHAR(255),
    PosterURL   VARCHAR(255),
    Status      VARCHAR(50) DEFAULT 'Coming Soon',  -- Now Showing, Coming Soon, Stopped, deleted
    MainCast    NVARCHAR(MAX)
);
-- 8. BẢNG THỂ LOẠI PHIM
CREATE TABLE Genres (
    GenreID   INT IDENTITY(1,1) PRIMARY KEY,
    GenreName NVARCHAR(100) NOT NULL UNIQUE
);
-- 9. BẢNG TRUNG GIAN PHIM & THỂ LOẠI
CREATE TABLE Movie_Genres (
    MovieID INT NOT NULL,
    GenreID INT NOT NULL,
    PRIMARY KEY (MovieID, GenreID),
    FOREIGN KEY (MovieID) REFERENCES Movies(MovieID) ON DELETE CASCADE,
    FOREIGN KEY (GenreID) REFERENCES Genres(GenreID) ON DELETE CASCADE
);
-- 10. BẢNG ĐÁNH GIÁ PHIM
CREATE TABLE Reviews (
    ReviewID  INT IDENTITY(1,1) PRIMARY KEY,
    UserID    INT NOT NULL,
    MovieID   INT NOT NULL,
    Rating    INT CHECK (Rating >= 1 AND Rating <= 10),
    Comment   NVARCHAR(MAX),
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (MovieID) REFERENCES Movies(MovieID)
);
-- 11. BẢNG LỊCH CHIẾU
--     Code gọi cả st.Price lẫn st.BasePrice → giữ cả 2
CREATE TABLE Showtimes (
    ShowtimeID INT IDENTITY(1,1) PRIMARY KEY,
    MovieID    INT NOT NULL,
    RoomID     INT NOT NULL,
    StartTime  DATETIME NOT NULL,
    EndTime    DATETIME NOT NULL,
    BasePrice  DECIMAL(10,2) NOT NULL,
    Price      AS (BasePrice),                      -- Computed column = BasePrice
    Status     VARCHAR(50) DEFAULT 'active',
    FOREIGN KEY (MovieID) REFERENCES Movies(MovieID),
    FOREIGN KEY (RoomID) REFERENCES Rooms(RoomID)
);
GO
-- ===========================================================================
-- PHẦN 4: DỊCH VỤ VÀ KHUYẾN MÃI
-- ===========================================================================
-- 12. BẢNG ĐỒ ĂN / NƯỚC UỐNG (F&B)
--     Code gọi FnBID, Category, Stock, IsAvailable
CREATE TABLE FoodBeverages (
    FnBID       INT IDENTITY(1,1) PRIMARY KEY,
    Name        NVARCHAR(100) NOT NULL,
    Description NVARCHAR(255),
    Category    NVARCHAR(50) DEFAULT N'Combos',
    Price       DECIMAL(10,2) NOT NULL,
    Stock       INT DEFAULT 100,
    ImageURL    VARCHAR(255),
    IsAvailable BIT DEFAULT 1
);
-- 13. BẢNG MÃ KHUYẾN MÃI (VOUCHERS)
--     Code gọi VoucherID (PK), Code, DiscountType, DiscountValue, v.v.
CREATE TABLE Vouchers (
    VoucherID     INT IDENTITY(1,1) PRIMARY KEY,
    Code          VARCHAR(50) NOT NULL UNIQUE,
    DiscountType  VARCHAR(20) DEFAULT 'percent',    -- 'percent' hoặc 'fixed'
    DiscountValue DECIMAL(18,2) NOT NULL,
    MinOrderValue DECIMAL(18,2) DEFAULT 0,
    MaxDiscount   DECIMAL(18,2) NULL,
    UsageLimit    INT NULL,
    UsedCount     INT DEFAULT 0,
    StartDate     DATE NOT NULL,
    EndDate       DATE NOT NULL,
    IsActive      BIT DEFAULT 1
);
GO
-- ===========================================================================
-- PHẦN 5: ĐẶT VÉ ONLINE & BÁN VÉ TẠI QUẦY (Tickets)
--         bookingModel.js + staffModel.js dùng bảng Tickets + Ticket_FnB
-- ===========================================================================
-- 14. BẢNG VÉ (TICKETS)
CREATE TABLE Tickets (
    TicketID      INT IDENTITY(1,1) PRIMARY KEY,
    UserID        INT NULL,                         -- NULL nếu bán tại quầy không có tài khoản
    ShowtimeID    INT NOT NULL,
    SeatID        INT NOT NULL,
    VoucherID     INT NULL,
    TicketPrice   DECIMAL(18,2) NOT NULL,           -- Giá gốc 1 vé
    TotalAmount   DECIMAL(18,2) NOT NULL,           -- Tổng tiền sau giảm giá (chia đều)
    PaymentMethod VARCHAR(50) DEFAULT 'Cash',
    Status        VARCHAR(50) DEFAULT 'pending',    -- pending, confirmed, used, cancelled
    SoldBy        INT NULL,                         -- Staff ID nếu bán tại quầy
    BookedAt      DATETIME DEFAULT GETDATE(),
    CheckedAt     DATETIME NULL,                    -- Thời điểm soát vé
    QRCode        VARCHAR(255) NULL,
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (ShowtimeID) REFERENCES Showtimes(ShowtimeID),
    FOREIGN KEY (SeatID) REFERENCES Seats(SeatID),
    FOREIGN KEY (VoucherID) REFERENCES Vouchers(VoucherID),
    FOREIGN KEY (SoldBy) REFERENCES Users(UserID)
);
-- 15. BẢNG F&B ĐI KÈM VÉ
CREATE TABLE Ticket_FnB (
    TicketID INT NOT NULL,
    FnBID    INT NOT NULL,
    Quantity INT NOT NULL DEFAULT 1,
    PRIMARY KEY (TicketID, FnBID),
    FOREIGN KEY (TicketID) REFERENCES Tickets(TicketID),
    FOREIGN KEY (FnBID) REFERENCES FoodBeverages(FnBID)
);
GO
-- ===========================================================================
-- PHẦN 6: GIAO DỊCH (BOOKINGS) - Dùng cho Dashboard Admin
--         adminModel.js: getDashboardStats, getRecentTransactions,
--                        getMonthlyRevenue, getTopMovies
-- ===========================================================================
-- 16. BẢNG ĐƠN ĐẶT VÉ TỔNG
CREATE TABLE Bookings (
    BookingID     INT IDENTITY(1,1) PRIMARY KEY,
    UserID        INT NOT NULL,
    ShowtimeID    INT NOT NULL,
    VoucherCode   VARCHAR(50) NULL,
    TotalAmount   DECIMAL(10,2) NOT NULL,
    BookingTime   DATETIME DEFAULT GETDATE(),
    PaymentMethod VARCHAR(50),                      -- MoMo, VNPAY, ZaloPay
    PaymentStatus VARCHAR(50) DEFAULT 'Pending',    -- Pending, Success, Failed
    QRCode        VARCHAR(255) UNIQUE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (ShowtimeID) REFERENCES Showtimes(ShowtimeID)
);
-- 17. BẢNG CHI TIẾT VÉ TRONG ĐƠN
CREATE TABLE BookingTickets (
    TicketID  INT IDENTITY(1,1) PRIMARY KEY,
    BookingID INT NOT NULL,
    SeatID    INT NOT NULL,
    Price     DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (BookingID) REFERENCES Bookings(BookingID),
    FOREIGN KEY (SeatID) REFERENCES Seats(SeatID)
);
-- 18. BẢNG F&B ĐI KÈM ĐƠN
CREATE TABLE Booking_FnB (
    BookingID INT NOT NULL,
    FnBID     INT NOT NULL,
    Quantity  INT NOT NULL DEFAULT 1,
    Price     DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (BookingID, FnBID),
    FOREIGN KEY (BookingID) REFERENCES Bookings(BookingID),
    FOREIGN KEY (FnBID) REFERENCES FoodBeverages(FnBID)
);
GO
-- ===========================================================================
-- PHẦN 7: BẢNG PHỤ TRỢ
-- ===========================================================================
-- 19. BẢNG TRẠNG THÁI GHẾ THEO SUẤT CHIẾU (Xử lý đồng thời)
CREATE TABLE ShowtimeSeats (
    ShowtimeSeatID INT IDENTITY(1,1) PRIMARY KEY,
    ShowtimeID     INT NOT NULL,
    SeatID         INT NOT NULL,
    Status         VARCHAR(20) DEFAULT 'Available',  -- Available, Locked, Sold
    LockedBy       INT NULL,
    LockedUntil    DATETIME NULL,
    FOREIGN KEY (ShowtimeID) REFERENCES Showtimes(ShowtimeID),
    FOREIGN KEY (SeatID) REFERENCES Seats(SeatID),
    FOREIGN KEY (LockedBy) REFERENCES Users(UserID)
);
GO
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║                     CHÈN DỮ LIỆU MẪU (SEED DATA)                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ═══════════════════ QUYỀN & TÀI KHOẢN ═══════════════════
INSERT INTO Roles (RoleName) VALUES ('Admin'), ('Customer');
-- Mật khẩu mặc định: 123456 (bcrypt hash)
INSERT INTO Users (RoleID, FullName, Email, PasswordHash, Phone, IsActive) VALUES
(1, N'Quản Trị Viên',     'Tandat@gmail.com',    '$2b$10$u9qPYGtQaUpuUKNl9t/PGOxBxggWXavSRyhnfsXRo/s9c48iJAtvi', '0901111111', 1),
(2, N'Lê Hoàng Nam',       'nam@gmail.com',        '$2b$10$u9qPYGtQaUpuUKNl9t/PGOxBxggWXavSRyhnfsXRo/s9c48iJAtvi', '0905555555', 1);
GO
-- ═══════════════════ CỤM RẠP ═══════════════════
INSERT INTO Cinemas (CinemaName, Address, City) VALUES
(N'D-CINEMA Nguyễn Huệ',          N'123 Nguyễn Huệ, Quận 1',           N'Hồ Chí Minh'),
(N'D-CINEMA Sư Vạn Hạnh',         N'456 Sư Vạn Hạnh, Quận 10',         N'Hồ Chí Minh'),
(N'D-CINEMA Landmark 81',          N'Tầng B1 Landmark 81, Bình Thạnh',   N'Hồ Chí Minh'),
(N'D-CINEMA Giga Mall',            N'Tầng 6 Giga Mall, Thủ Đức',         N'Hồ Chí Minh'),
(N'D-CINEMA Vincom Bà Triệu',     N'Tầng 6 Vincom Center, Hai Bà Trưng',N'Hà Nội'),
(N'D-CINEMA Royal City',           N'Tầng B2 Vincom Mega Mall, Thanh Xuân',N'Hà Nội'),
(N'D-CINEMA Lotte Center',         N'Tầng 6 Lotte Center, Ba Đình',      N'Hà Nội'),
(N'D-CINEMA Aeon Mall Long Biên',  N'Tầng 4 Aeon Mall, Long Biên',       N'Hà Nội'),
(N'D-CINEMA Vincom Đà Nẵng',      N'Tầng 4 Vincom Center, Hải Châu',    N'Đà Nẵng'),
(N'D-CINEMA GO! Đà Nẵng',         N'Khu thương mại GO!, Thanh Khê',     N'Đà Nẵng'),
(N'D-CINEMA Sense City Cần Thơ',   N'Tầng 3 Sense City, Ninh Kiều',      N'Cần Thơ'),
(N'D-CINEMA Imperial Vũng Tàu',   N'159-163 Thùy Vân, TP. Vũng Tàu',   N'Vũng Tàu');
GO
-- ═══════════════════ PHÒNG CHIẾU ═══════════════════
INSERT INTO Rooms (CinemaID, RoomName, TotalSeats) VALUES
-- D-CINEMA Nguyễn Huệ (CinemaID=1)
(1, N'Cinema 1', 100), (1, N'Cinema 2', 120), (1, N'Cinema VIP', 50),
-- D-CINEMA Sư Vạn Hạnh (CinemaID=2)
(2, N'Standard 1', 110), (2, N'Standard 2', 110), (2, N'Sweetbox Couple', 50),
-- D-CINEMA Landmark 81 (CinemaID=3)
(3, N'IMAX 1', 250), (3, N'Standard 2', 120), (3, N'VIP Lounge', 40),
-- D-CINEMA Giga Mall (CinemaID=4)
(4, N'Standard 1', 110), (4, N'Standard 2', 110),
-- D-CINEMA Vincom Bà Triệu (CinemaID=5)
(5, N'IMAX 3D', 300), (5, N'Standard 1', 150), (5, N'Standard 2', 130), (5, N'VIP 1', 45),
-- D-CINEMA Royal City (CinemaID=6)
(6, N'Premium 1', 100), (6, N'Premium 2', 100), (6, N'Family Room', 80),
-- D-CINEMA Lotte Center (CinemaID=7)
(7, N'Standard 1', 120), (7, N'Standard 2', 110), (7, N'VIP', 30),
-- D-CINEMA Aeon Mall Long Biên (CinemaID=8)
(8, N'Standard 1', 140), (8, N'Standard 2', 140),
-- D-CINEMA Vincom Đà Nẵng (CinemaID=9)
(9, N'Standard 1', 115), (9, N'Standard 2', 115), (9, N'Premium', 60),
-- D-CINEMA GO! Đà Nẵng (CinemaID=10)
(10, N'Standard 1', 100), (10, N'Sweetbox', 40),
-- D-CINEMA Sense City Cần Thơ (CinemaID=11)
(11, N'IMAX Laser', 280), (11, N'Standard', 130),
-- D-CINEMA Imperial Vũng Tàu (CinemaID=12)
(12, N'Standard 1', 110), (12, N'Standard 2', 120);
GO
-- ═══════════════════ GHẾ NGỒI ═══════════════════
-- Tạo ghế tự động cho tất cả các phòng: Hàng A-F, mỗi hàng 10 ghế
DECLARE @rid INT, @row CHAR(1), @num INT, @type VARCHAR(20);
DECLARE room_cursor CURSOR FOR SELECT RoomID FROM Rooms;
OPEN room_cursor;
FETCH NEXT FROM room_cursor INTO @rid;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @row = 'A';
    WHILE @row <= 'F'
    BEGIN
        SET @num = 1;
        WHILE @num <= 10
        BEGIN
            SET @type = CASE
                WHEN @row IN ('E','F') THEN 'VIP'
                ELSE 'Normal'
            END;
            INSERT INTO Seats (RoomID, SeatRow, SeatNumber, SeatType, PriceMultiplier)
            VALUES (@rid, @row, @num, @type, CASE WHEN @type = 'VIP' THEN 1.5 ELSE 1.0 END);
            SET @num = @num + 1;
        END
        SET @row = CHAR(ASCII(@row) + 1);
    END
    FETCH NEXT FROM room_cursor INTO @rid;
END
CLOSE room_cursor;
DEALLOCATE room_cursor;
PRINT N'✅ Đã tạo ghế cho tất cả phòng chiếu';
GO
-- ═══════════════════ THỂ LOẠI PHIM ═══════════════════
INSERT INTO Genres (GenreName) VALUES
(N'Hành động'), (N'Hài'), (N'Kinh dị'), (N'Tình cảm'),
(N'Viễn tưởng'), (N'Hoạt hình'), (N'Tâm lý'), (N'Phiêu lưu'), (N'Ca Nhạc'), (N'Ly Kì'), (N'Gia đình');
GO
-- ═══════════════════ PHIM ═══════════════════
INSERT INTO Movies (Title, Description, Director, Duration, AgeRating, TrailerURL, PosterURL, Status, MainCast) VALUES
(N'Ốc Mượn Hồn', N'Câu chuyện kể về Quân – một người chồng đau khổ khi vợ qua đời trong một tai nạn bất ngờ. Hạnh phúc tưởng chừng được hồi sinh khi linh hồn vợ anh "trở về" trong thân xác của cô đồng nghiệp, người gặp tai nạn chung với vợ Quân nhưng may mắn sống sót. Giống như những con ốc mượn hồn, họ đều bám víu - lệ thuộc vào chiếc vỏ khác để tồn tại cũng như cố lẩn tránh nỗi đau của cuộc đời. Niềm vui ngắn ngủi tan biến khi một bí mật kinh hoàng liên quan đến cái chết của vợ anh được hé lộ, đặt Quân trước lựa chọn giữa việc tiếp tục bám víu, chấp nhận chiếc vỏ của hạnh phúc tự tạo hay phanh phui sự thật kinh hoàng bên trong chính chiếc vỏ này.', N'Đinh Tuấn Vũ', 109, 'T16', 'https://www.youtube.com/embed/XQs8E1QFaxs', 'images/movie_ocmuonhon.png', 'Now Showing', N'Quốc Trường, Trần Tiểu Vy, Anh Phạm'),
(N'Ma Xó', N'Trong cái nghèo cùng cực và nỗi sợ mất con sau một lần sảy thai, cuộc sống của vợ chồng Phú và Thảo (đang mang thai) trở nên tăm tối hơn bao giờ hết khi bà Thuận (mẹ Phú) qua đời vì không có tiền chữa bệnh. Giữa lúc tuyệt vọng, Thảo nghe lời bà Tánh – một người hàng xóm làm nghề cúng – quyết định thực hiện nghi thức thỉnh "vong cô hồn" về làm ma xó để trấn giữ ngôi nhà và bảo vệ thai nhi. Khi thực thể trong xó nhà bắt đầu "đòi nợ", Thảo mới bàng hoàng nhận ra: thứ cô rước về để bảo vệ gia đình, thực chất là một cơn ác mộng không có đường lui.', N'Phan Bá Hỷ', 102, 'T18', 'https://www.youtube.com/watch?v=MmE_ks7V1S0', 'images/movie_maxo.png', 'Now Showing', N'Lê Khánh, Tín Nguyễn, Avin Lu, Hạnh Thúy'),
(N'Dưới Bóng Điện Hạ', N'Lấy mốc năm 1457 dưới triều đại Joseon, Dưới Bóng Điện Hạ khắc họa số phận nghiệt ngã của vua Danjong - vị quân vương thứ sáu của triều đại (Park Ji-hoon thủ vai). Lên ngôi khi tuổi đời còn non trẻ, Danjong nhanh chóng trở thành quân cờ trong vòng xoáy quyền lực tàn khốc. Bị chính người chú lật đổ, phế truất và đày đến vùng Cheongnyeongpo heo hút, cuộc đời của vị vua trẻ rẽ sang một ngã rẽ đầy u uất. Tại chốn lưu đày, ông gặp trưởng làng Eom Heung Do (Yoo Hai-jin thủ vai) - người đã chủ động biến ngôi làng nghèo thành nơi giam giữ nhà vua, đổi lại hy vọng cứu vãn sinh kế cho dân làng. Từ hai thân phận tưởng chừng đối lập, một cựu đế vương và một thường dân, bộ phim dần hé mở mối liên kết lặng lẽ nhưng sâu sắc - nơi lòng trung thành, sự che chở âm thầm và những phận người nhỏ bé cùng trôi dạt giữa cơn sóng lớn của lịch sử.', N'Chang Hang Jun', 117, 'T16', 'https://www.youtube.com/watch?v=aPsEOR-WK6U', 'images/movie_duoibongdienha.png', 'Now Showing', N'Yoo Hai Jin, Park Ji Hoon, Yoo Ji Tae'),
(N'Siêu Quậy Marsupilami', N'Để cứu lấy công việc, David Ticoule chấp nhận vận chuyển một kiện hàng bí ẩn từ Nam Mỹ về Pháp. Anh đưa con trai Léo và vợ cũ Tess đi cùng, vô tình kéo họ vào một phi vụ nguy hiểm mà chính anh cũng chưa kịp hiểu rõ. Từ một chuyến đi tưởng chừng đơn giản, hành trình trên biển cả biến thành chuỗi tình huống dở khóc dở cười.', N'Philippe Lacheau', 99, 'P', 'https://www.youtube.com/watch?v=xzc6xQfWq4E', 'images/movie_marsupilami.png', 'Now Showing', NULL),
(N'John Wick: Chapter 4', N'John Wick tìm ra con đường đánh bại Hội Đồng Tối Cao. Nhưng trước khi có thể giành lại tự do, Wick phải đối đầu với một kẻ thù mới với những liên minh hùng mạnh trên toàn cầu và những người bạn cũ nay đã hóa kẻ thù.', N'Chad Stahelski', 169, 'T18', 'https://www.youtube.com/watch?v=qEVUtrk8_B4', 'images/movie_john_wick_4.png', 'Now Showing', N'Keanu Reeves, Donnie Yen, Bill Skarsgård'),
(N'Doraemon Movie 45 (2026): Nobita Và Lâu Đài Dưới Đáy Biển', N'Bước vào kì nghỉ hè, Nobita và các bạn tranh cãi chí chóe về địa điểm cắm trại. Theo đề xuất của Doraemon, cả nhóm quyết định cắm trại giữa lòng đại dương! Sử dụng bảo bối thần kì “xe Buggy chạy dưới nước” và “đèn pin thích nghi”, 5 bạn nhỏ tận hưởng chuyến cắm trại dưới biển, gặp gỡ vô vàn sinh vật lí thú trên đường đi. Sau khi phát hiện một chiếc tàu đắm, nhóm bạn đã gặp chàng thanh niên bí ẩn El. Thật bất ngờ, anh ta lại là cư dân đáy biển, sống tại “liên bang Mu”, một vùng biển rộng lớn! Vốn căm ghét người mặt đất, cư dân đáy biển không thể nào tin tưởng Nobita và các bạn. Đúng lúc đó, lời thông báo “lâu đài quỷ… đã bắt đầu phục sinh!!” được truyền tới. “Lâu đài quỷ” khiến cư dân đáy biển khiếp sợ, rốt cuộc là gì? Đặt trọn niềm tin vào bè bạn trong lồng ngực, chuyến phiêu lưu vĩ đại quyết định số phận của trái đất, bắt đầu!', N'Tetsuo Yajima', 101, 'P', 'https://www.youtube.com/watch?v=u3JgYkmuK78&t=1s', 'images/doraemon_sea.png', 'Now Showing', N'Wasabi Mizuta, Megumi Oohara, Yumi Kakazu, Subaru Kimura, Tomokazu Seki'),
(N'BTS World Tour ''Arirang'' In Busan: Live Viewing', N'Hành trình lịch sử tiếp tục được viết nên. Sau màn khởi động phá vỡ mọi kỷ lục của World Tour “ARIRANG”, những biểu tượng nhạc pop BTS sẽ trở lại sân vận động Busan Asiad Main Stadium trong một đêm concert mang ý nghĩa đặc biệt, được truyền hình trực tiếp đến các rạp chiếu phim trên toàn thế giới. Đây cũng là lần trở lại đầy xúc động tại chính địa điểm mà nhóm đã có sân khấu biểu diễn đầy đủ thành viên cuối cùng trước thời gian nhập ngũ cách đây 3 năm 8 tháng.Đi qua 34 thành phố với 85 đêm diễn, tour diễn này thiết lập cột mốc mới khi trở thành chuyến lưu diễn quy mô lớn nhất từng được thực hiện bởi một nghệ sĩ Hàn Quốc. Đặc biệt hơn, concert diễn ra vào ngày 13 tháng 6 — ngày kỷ niệm debut của BTS — càng khiến sự kiện mang thêm ý nghĩa sâu sắc khi nhóm nhìn lại loạt thành tựu đã cùng nhau tạo dựng và hướng tới tương lai phía trước. Mang tên “ARIRANG”, tour diễn đồng hành cùng album phòng thu thứ năm của BTS, đan xen những góc nhìn nội tâm chân thật cùng các chủ đề phổ quát về nỗi nhớ và tình yêu sâu đậm — những yếu tố làm nên bản sắc riêng của nhóm. Với thiết kế sân khấu 360 độ đặc trưng đầy choáng ngợp, concert mang đến trải nghiệm nhập vai, đưa khán giả trở thành một phần trong khoảnh khắc lễ hội ấy. Cùng nhau hòa mình vào những khoảnh khắc bùng nổ trong màn tái xuất mang tính biểu tượng của BTS trên màn ảnh rộng toàn cầu — với 2 sự kiện cực đại: Ngày 13/6 và 14/6 được PHÁT TRỰC TIẾP TỪ BUSAN. Phim mới BTS WORLD TOUR ‘ARIRANG’ IN BUSAN: LIVE VIEWING có suất chiếu LIVE - Phát Sóng Trực Tiếp vào 16:45 ngày 13.06 và REBROADCAST - Phát Lại vào 16:45 ngày 14.06.2026 tại các rạp chiếu phim toàn quốc.', N'Đang cập nhật', 0, 'P', 'https://www.youtube.com/watch?v=3DxPbeFtoDI&t=1s', 'images/movie_bts_arirang.png', 'Now Showing', N'BTS'),
(N'Lầu Chú Hỏa', N'Để câu view, một nhóm streamer livestream khám phá Lầu Chú Hỏa, dinh thự bỏ hoang gắn với truyền thuyết về con ma nhà họ Hứa. Nhưng ngay từ những phút đầu, mọi thứ đã vượt khỏi tầm kiểm soát. Hiện tượng siêu nhiên liên tiếp xảy ra, kéo cả nhóm vào vòng xoáy ám ảnh không lối thoát. Buổi livestream nhanh chóng biến thành nơi “tạo nghiệp – trả nghiệp”, khi từng người phải trả giá cho lòng tham và sự báng bổ trước linh hồn oan khuất của cô tiểu thư họ Hứa.', N'Hùng Trấn', 94, 'T18', 'https://www.youtube.com/watch?v=iYH9lUytbmA', 'images/movie_lau_chu_hoa.png', 'Now Showing', N'Trần Kỳ Anh, Nguyễn Minh Thời, Ngọc Chí Bảo'),
(N'Cơn Thịnh Nộ', N'Phim xoay quanh Wang Wei (Xie Miao), một người bán hàng bị câm, đang sinh sống ở Hồng Kông cùng con gái Rainy (Yang Enyou). Một ngày nọ, Rainy bị một đường dây buôn bán trẻ em bắt cóc. Wei tìm đến cảnh sát giúp đỡ nhưng bị từ chối vì cảnh sát ở đây đều đã bị tha hóa. Wei bắt đầu một cuộc trả thù không ngừng nghỉ để giải cứu con gái. Anh liên minh với Navin (Joe Taslim), một nhà báo có vợ mất tích khi đang điều tra cùng một đường dây buôn người.', N'Tanigaki Kenji', 110, 'T18', 'https://www.youtube.com/watch?v=F3PxYKjTVTA', 'images/movie_con_thinh_no.png', 'Now Showing', N'Tạ Miêu, Joe Taslim, Yang Enyou'),
(N'Câu Chuyện Đồ Chơi 5', N'Các món đồ chơi đã trở lại trong Toy Story 5 của Disney và Pixar, và lần này sẽ là cuộc đối đầu giữa đồ chơi và công nghệ. Buzz, Woody, Jessie cùng cả nhóm đồ chơi quen thuộc sẽ phải đối mặt với thử thách khó khăn hơn gấp bội khi chạm trán một mối đe dọa ảnh hưởng đến toàn bộ thế giới đồ chơi.', N'Andrew Stanton', 102, 'P', 'https://www.youtube.com/watch?v=BXN2fTDtak8', 'images/movie_toy_story_5.png', 'Coming Soon', N'Tom Hanks, Keanu Reeves, Bonnie Hunt'),
(N'Trường Hè, 2001', N'Lấy bối cảnh mùa hè năm 2001, phim theo chân Kiên - cậu thanh niên 17 tuổi từ Việt Nam trở về đoàn tụ với gia đình tại khu chợ nhộn nhịp ở thị trấn Cheb sau 10 năm xa cách. Chuyến trở về mở ra nhiều mâu thuẫn liên thế hệ, cảm giác lạc lõng và nỗi khao khát được thấu hiểu trong gia đình nhập cư.', N'Dužan Duong', 0, 'P', 'https://www.youtube.com/watch?v=j4cUB08ASNE', 'images/movie_truong_he_2001.png', 'Coming Soon', N'Doãn Hoàng Anh, Tiến Tài, Bùi Thế Dương, Lê Quỳnh Lan, Ngô Xuân Thắng');
GO
-- Gắn thể loại cho phim
INSERT INTO Movie_Genres (MovieID, GenreID) VALUES
(1, 7), (1, 3), -- Ốc Mượn Hồn: Tâm lý, Kinh dị
(2, 3),          -- Ma Xó: Kinh dị
(3, 7),          -- Dưới Bóng Điện Hạ: Tâm lý
(4, 2), (4, 8), -- Siêu Quậy Marsupilami: Hài, Phiêu lưu
(5, 1),          -- John Wick 4: Hành động
(6, 6), (6, 8), (6, 5), -- Doraemon 45: Hoạt hình, Phiêu lưu, Viễn tưởng
(7, 9), -- BTS: Ca Nhạc
(8, 3), (8, 10), -- Lầu Chú Hỏa: Kinh dị, Ly Kì
(9, 1), -- Cơn Thịnh Nộ: Hành động
(10, 6), (10, 8), (10, 2), -- Câu Chuyện Đồ Chơi 5: Hoạt hình, Phiêu lưu, Hài
(11, 7), (11, 11); -- Trường Hè, 2001: Tâm lý, Gia đình
GO
-- ═══════════════════ LỊCH CHIẾU ═══════════════════
DECLARE @Today DATETIME = CAST(CAST(GETDATE() AS DATE) AS DATETIME);
DECLARE @CinemaID INT, @RoomID INT, @MovieID INT;
DECLARE @DayOffset INT;
DECLARE @StartTime DATETIME, @EndTime DATETIME;

-- Table variable to temporarily hold room info with row index for partition distribution
DECLARE @CinemaRooms TABLE (
    CinemaID INT,
    RoomID INT,
    RowIdx INT
);

INSERT INTO @CinemaRooms (CinemaID, RoomID, RowIdx)
SELECT CinemaID, RoomID, 
       ROW_NUMBER() OVER (PARTITION BY CinemaID ORDER BY RoomID) - 1
FROM Rooms;

-- Generate showtimes for the next 7 days (day 0 to day 6)
SET @DayOffset = 0;
WHILE @DayOffset <= 6
BEGIN
    -- Loop through each Cinema
    DECLARE cinema_cursor CURSOR FOR SELECT CinemaID FROM Cinemas;
    OPEN cinema_cursor;
    FETCH NEXT FROM cinema_cursor INTO @CinemaID;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Get rooms count for this cinema
        DECLARE @RoomCount INT = (SELECT COUNT(*) FROM @CinemaRooms WHERE CinemaID = @CinemaID);
        
        -- Loop through all Now Showing movies
        DECLARE movie_cursor CURSOR FOR SELECT MovieID, Duration FROM Movies WHERE Status = 'Now Showing';
        OPEN movie_cursor;
        DECLARE @Duration INT;
        FETCH NEXT FROM movie_cursor INTO @MovieID, @Duration;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            -- Distribute movies across the cinema's rooms
            IF @RoomCount > 0
            BEGIN
                SET @RoomID = (SELECT RoomID FROM @CinemaRooms WHERE CinemaID = @CinemaID AND RowIdx = (@MovieID % @RoomCount));
                
                -- Slot 1: 10:00 AM
                SET @StartTime = DATEADD(minute, 600, DATEADD(day, @DayOffset, @Today));
                SET @EndTime = DATEADD(minute, COALESCE(NULLIF(@Duration, 0), 120), @StartTime);
                INSERT INTO Showtimes (MovieID, RoomID, StartTime, EndTime, BasePrice, Status)
                VALUES (@MovieID, @RoomID, @StartTime, @EndTime, 90000, 'active');
                
                -- Slot 2: 3:00 PM
                SET @StartTime = DATEADD(minute, 900, DATEADD(day, @DayOffset, @Today));
                SET @EndTime = DATEADD(minute, COALESCE(NULLIF(@Duration, 0), 120), @StartTime);
                INSERT INTO Showtimes (MovieID, RoomID, StartTime, EndTime, BasePrice, Status)
                VALUES (@MovieID, @RoomID, @StartTime, @EndTime, 90000, 'active');
                
                -- Slot 3: 8:00 PM
                SET @StartTime = DATEADD(minute, 1200, DATEADD(day, @DayOffset, @Today));
                SET @EndTime = DATEADD(minute, COALESCE(NULLIF(@Duration, 0), 120), @StartTime);
                INSERT INTO Showtimes (MovieID, RoomID, StartTime, EndTime, BasePrice, Status)
                VALUES (@MovieID, @RoomID, @StartTime, @EndTime, 110000, 'active');
            END
            
            FETCH NEXT FROM movie_cursor INTO @MovieID, @Duration;
        END
        CLOSE movie_cursor;
        DEALLOCATE movie_cursor;
        
        FETCH NEXT FROM cinema_cursor INTO @CinemaID;
    END
    CLOSE cinema_cursor;
    DEALLOCATE cinema_cursor;
    
    SET @DayOffset = @DayOffset + 1;
END
GO
-- ═══════════════════ ĐỒ ĂN & NƯỚC UỐNG ═══════════════════
INSERT INTO FoodBeverages (Name, Description, Category, Price, Stock, ImageURL, IsAvailable) VALUES
(N'Combo Solo',        N'1 Bắp ngọt nhỏ + 1 Nước ngọt lớn',        N'Combos',            55000,  200, 'images/combo_solo.png', 1),
(N'Combo Couple',      N'1 Bắp ngọt lớn + 2 Nước ngọt lớn',        N'Combos',            95000,  150, 'images/combo_couple.png', 1),
(N'Combo Family',      N'2 Bắp ngọt lớn + 4 Nước ngọt lớn',        N'Combos',            175000, 100, 'images/combo_mega.png', 1),
(N'Bắp Ngọt Lớn',     N'Bắp rang bơ caramel size lớn',             N'Bắp rang & Snack',  45000,  300, 'images/combo_popcorn.png', 1),
(N'Bắp Phô Mai',      N'Bắp rang rắc phô mai đặc biệt',           N'Bắp rang & Snack',  50000,  200, 'images/combo_popcorn.png', 1),
(N'Nachos Grande',     N'Nachos giòn kèm sốt phô mai và salsa',    N'Bắp rang & Snack',  60000,  80,  'images/snack_nachos.png', 1),
(N'Coca-Cola Lớn',     N'Coca-Cola 500ml',                          N'Nước uống',         30000,  500, 'images/drink_coca_cola.png', 1),
(N'Trà Đào Cam Sả',   N'Trà đào thanh mát vị cam và sả',          N'Nước uống',         35000,  300, 'images/drink_peach_tea.png', 1),
(N'Nước Suối',         N'Nước suối tinh khiết 500ml',               N'Nước uống',         15000,  1000,'images/drink_water.png', 1);
GO
-- ═══════════════════ MÃ KHUYẾN MÃI ═══════════════════
INSERT INTO Vouchers (Code, DiscountType, DiscountValue, MinOrderValue, MaxDiscount, UsageLimit, StartDate, EndDate, IsActive) VALUES
('GIAM20K',    'fixed',   20000, 100000, NULL,   100, GETDATE(), DATEADD(day, 30, GETDATE()), 1),
('GIAM10PT',   'percent', 10,    150000, 50000,  50,  GETDATE(), DATEADD(day, 30, GETDATE()), 1),
('WELCOME50',  'percent', 50,    200000, 100000, 200, GETDATE(), DATEADD(day, 60, GETDATE()), 1),
('HEQUA2025',  'fixed',   30000, 80000,  NULL,   500, GETDATE(), DATEADD(day, 90, GETDATE()), 1),
('GIAM50K',    'fixed',   50,    1,      NULL,   50,  '2026-06-15', '2026-06-20', 1);
GO
-- ═══════════════════ GIAO DỊCH MẪU (BOOKINGS) ═══════════════════
-- Tìm CustomerRoleID theo tên để tránh hardcode số
DECLARE @CustomerRoleID INT = (SELECT RoleID FROM Roles WHERE RoleName = 'Customer');
DECLARE @CustID INT = (SELECT TOP 1 UserID FROM Users WHERE RoleID = @CustomerRoleID ORDER BY UserID ASC);
DECLARE @CustID2 INT = (SELECT TOP 1 UserID FROM Users WHERE RoleID = @CustomerRoleID AND UserID > @CustID ORDER BY UserID ASC);
-- Fallback: nếu vẫn NULL thì lấy user đầu tiên
IF @CustID IS NULL SET @CustID = (SELECT TOP 1 UserID FROM Users);
IF @CustID2 IS NULL SET @CustID2 = @CustID;
PRINT N'DEBUG: @CustID=' + CAST(ISNULL(@CustID,0) AS VARCHAR) + ', @CustID2=' + CAST(ISNULL(@CustID2,0) AS VARCHAR);
INSERT INTO Bookings (UserID, ShowtimeID, TotalAmount, BookingTime, PaymentMethod, PaymentStatus, QRCode) VALUES
(@CustID,  1, 170000,  '2025-01-15 10:00:00', 'MoMo',    'Success', 'QR-20250115-001'),
(@CustID,  2, 270000,  '2025-02-20 12:00:00', 'VNPAY',   'Success', 'QR-20250220-001'),
(@CustID,  3, 335000,  '2025-03-10 14:00:00', 'ZaloPay',  'Success', 'QR-20250310-001'),
(@CustID2, 4, 240000,  '2025-04-05 16:00:00', 'MoMo',    'Success', 'QR-20250405-001'),
(@CustID,  1, 320000,  '2025-05-12 09:30:00', 'MoMo',    'Success', 'QR-20250512-001'),
(@CustID2, 5, 150000,  '2025-06-01 13:00:00', 'VNPAY',   'Success', 'QR-20250601-001'),
(@CustID,  6, 560000,  GETDATE(),             'ZaloPay',  'Success', 'QR-TODAY-001'),
(@CustID2, 7, 235000,  GETDATE(),             'MoMo',    'Success', 'QR-TODAY-002'),
(@CustID,  1, 170000,  GETDATE(),             'VNPAY',   'Success', 'QR-TODAY-003'),
(@CustID2, 2, 180000,  GETDATE(),             'MoMo',    'Pending', 'QR-TODAY-004');
GO
-- ═══════════════════ CHI TIẾT VÉ TRONG ĐƠN ═══════════════════
INSERT INTO BookingTickets (BookingID, SeatID, Price) VALUES
(1,  1, 85000), (1,  2, 85000),
(2,  3, 90000), (2,  4, 90000), (2,  5, 90000),
(3,  6, 85000), (3,  7, 85000),
(4,  8, 120000), (4,  9, 120000),
(5,  10, 85000), (5,  11, 85000), (5,  12, 85000),
(6,  13, 75000), (6,  14, 75000),
(7,  15, 120000), (7,  16, 120000), (7,  17, 120000),
(8,  18, 95000), (8,  19, 95000),
(9,  20, 85000), (9,  21, 85000),
(10, 22, 90000), (10, 23, 90000);
GO
-- ═══════════════════ F&B ĐI KÈM ĐƠN ═══════════════════
INSERT INTO Booking_FnB (BookingID, FnBID, Quantity, Price) VALUES
(1, 1, 1, 55000),
(2, 2, 1, 95000),
(3, 1, 2, 55000),  (3, 7, 2, 30000),
(5, 3, 1, 175000),
(7, 2, 2, 95000),  (7, 4, 1, 45000),
(8, 1, 1, 55000),
(9, 7, 2, 30000);
GO
-- ═══════════════════ VÉ MẪU (TICKETS) ═══════════════════
DECLARE @CustRole INT = (SELECT RoleID FROM Roles WHERE RoleName = 'Customer');
DECLARE @C1 INT = (SELECT TOP 1 UserID FROM Users WHERE RoleID = @CustRole);
IF @C1 IS NULL SET @C1 = (SELECT TOP 1 UserID FROM Users);
INSERT INTO Tickets (UserID, ShowtimeID, SeatID, TicketPrice, TotalAmount, PaymentMethod, Status, BookedAt) VALUES
(@C1, 1, 1,  85000,  85000,  'MoMo',   'confirmed', DATEADD(day, -2, GETDATE())),
(@C1, 1, 2,  85000,  85000,  'MoMo',   'confirmed', DATEADD(day, -2, GETDATE())),
(@C1, 3, 6,  90000,  90000,  'VNPAY',  'confirmed', DATEADD(day, -1, GETDATE())),
(@C1, 5, 13, 75000,  75000,  'Cash',   'confirmed', GETDATE()),
(@C1, 5, 14, 75000,  75000,  'Cash',   'pending',   GETDATE());
GO
-- ═══════════════════ ĐÁNH GIÁ MẪU ═══════════════════
DECLARE @ReviewRole INT = (SELECT RoleID FROM Roles WHERE RoleName = 'Customer');
DECLARE @R1 INT = (SELECT TOP 1 UserID FROM Users WHERE RoleID = @ReviewRole);
IF @R1 IS NULL SET @R1 = (SELECT TOP 1 UserID FROM Users);
INSERT INTO Reviews (UserID, MovieID, Rating, Comment) VALUES
(@R1, 1, 9,  N'Phim rất đẹp, hiệu ứng hình ảnh tuyệt vời!'),
(@R1, 2, 8,  N'Cốt truyện hấp dẫn, diễn viên diễn xuất tốt.'),
(@R1, 3, 7,  N'Phim hài nhẹ nhàng, phù hợp gia đình.');
GO

-- ═══════════════════ BẢNG COMBO BẮP NƯỚC ═══════════════════
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Combo')
BEGIN
    CREATE TABLE Combo (
        ComboID INT IDENTITY(1,1) PRIMARY KEY,
        ComboName NVARCHAR(255) NOT NULL,
        Description NVARCHAR(1000),
        Price DECIMAL(18,2) NOT NULL,
        ImageURL NVARCHAR(500),
        Status NVARCHAR(50) DEFAULT 'Active', -- 'Active', 'Inactive', 'Deleted'
        CreatedAt DATETIME DEFAULT GETDATE()
    );
END
GO

-- ═══════════════════ BẢNG VOUCHER KHUYẾN MÃI ═══════════════════
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Voucher')
BEGIN
    CREATE TABLE Voucher (
        VoucherID INT IDENTITY(1,1) PRIMARY KEY,
        VoucherCode VARCHAR(50) NOT NULL UNIQUE,
        VoucherName NVARCHAR(255) NOT NULL,
        DiscountType VARCHAR(50) NOT NULL, -- 'Percentage' hoặc 'Fixed Amount'
        DiscountValue DECIMAL(18,2) NOT NULL,
        MinimumOrder DECIMAL(18,2) DEFAULT 0,
        MaximumDiscount DECIMAL(18,2) DEFAULT 0,
        UsageLimit INT DEFAULT 1,
        UsedCount INT DEFAULT 0,
        StartDate DATETIME NOT NULL,
        EndDate DATETIME NOT NULL,
        Status VARCHAR(50) DEFAULT 'Active', -- 'Active', 'Inactive', 'Expired'
        Description NVARCHAR(1000),
        CreatedAt DATETIME DEFAULT GETDATE()
    );

    INSERT INTO Voucher (VoucherCode, VoucherName, DiscountType, DiscountValue, MinimumOrder, MaximumDiscount, UsageLimit, UsedCount, StartDate, EndDate, Status, Description)
    VALUES 
    ('KM10PERCENT', N'Khuyến mãi 10% mùa hè', 'Percentage', 10.00, 100000.00, 50000.00, 100, 12, '2026-06-01', '2026-08-31', 'Active', N'Giảm giá 10% tối đa 50k cho đơn hàng từ 100k.'),
    ('KM100KFIXED', N'Khuyến mãi 100k tri ân', 'Fixed Amount', 100000.00, 500000.00, 100000.00, 50, 5, '2026-06-01', '2026-07-31', 'Active', N'Giảm trực tiếp 100k cho hóa đơn từ 500k.'),
    ('KMEXPIRED', N'Khuyến mãi đã hết hạn', 'Percentage', 20.00, 50000.00, 20000.00, 20, 20, '2026-01-01', '2026-03-01', 'Expired', N'Chương trình giảm giá đầu năm.');
END
GO



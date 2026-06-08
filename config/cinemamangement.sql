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
(N'Viễn tưởng'), (N'Hoạt hình'), (N'Tâm lý'), (N'Phiêu lưu');
GO
-- ═══════════════════ PHIM ═══════════════════
INSERT INTO Movies (Title, Description, Director, Duration, AgeRating, TrailerURL, PosterURL, Status, MainCast) VALUES
(N'Neon Horizon',        N'Thế giới tương lai nơi con người sống dưới bầu trời neon rực rỡ.', N'Marcus Thorne',   124, '13+', 'https://www.youtube.com/embed/gCcx85zLyz4', 'images/movie_neon_dreams.png', 'Now Showing',  N'Chris Evans, Zendaya'),
(N'The Last Echo',       N'Hành trình sinh tồn cuối cùng trong thế giới hậu tận thế.',        N'Sarah Jenkins',   110, '18+', 'https://www.youtube.com/embed/hEJnMQG96mg', 'images/movie_neon_dreams.png', 'Now Showing',  N'Tom Hardy, Ana de Armas'),
(N'Golden Age',          N'Câu chuyện về kỷ nguyên vàng của điện ảnh Việt Nam.',               N'Trấn Thành',      95,  'P',   'https://www.youtube.com/embed/xL-5J07pE9Q', 'images/movie_neon_dreams.png', 'Now Showing',  N'Trấn Thành, Lê Giang'),
(N'The Odyssey',         N'Thám hiểm vũ trụ tìm kiếm sự sống ngoài Trái Đất.',               N'Christopher Nolan',150, '13+', 'https://www.youtube.com/embed/zSWdZAIBEs4', 'images/movie_neon_dreams.png', 'Now Showing',  N'Matthew McConaughey'),
(N'Midnight Run',        N'Cuộc rượt đuổi đầy hồi hộp giữa thám tử và tên tội phạm.',       N'David Fincher',    118, '16+', 'https://www.youtube.com/embed/5iaYLCip5Qk', 'images/movie_neon_dreams.png', 'Now Showing',  N'Ryan Gosling, Emily Blunt'),
(N'Lật Mặt 8',          N'Phần tiếp theo của loạt phim Lật Mặt nổi tiếng.',                  N'Lý Hải',           130, '13+', 'https://www.youtube.com/embed/2Tz8aA0c0V0', 'images/movie_neon_dreams.png', 'Coming Soon',  N'Lý Hải, Trường Giang'),
(N'Avengers: Doomsday',  N'Biệt đội siêu anh hùng đối đầu với mối đe dọa cuối cùng.',       N'Russo Brothers',   180, '13+', 'https://www.youtube.com/embed/73_1biulkIE', 'images/movie_neon_dreams.png', 'Coming Soon',  N'Robert Downey Jr., Scarlett Johansson'),
(N'Inside Out 3',        N'Tiếp tục hành trình cảm xúc đầy màu sắc.',                        N'Pete Docter',      100, 'P',   'https://www.youtube.com/embed/LEjhYKPUtEs', 'images/movie_neon_dreams.png', 'Coming Soon',  N'Amy Poehler');
GO
-- Gắn thể loại cho phim
INSERT INTO Movie_Genres (MovieID, GenreID) VALUES
(1, 5), (1, 8), -- Neon Horizon: Viễn tưởng, Phiêu lưu
(2, 1), (2, 7), -- The Last Echo: Hành động, Tâm lý
(3, 2), (3, 4), -- Golden Age: Hài, Tình cảm
(4, 5), (4, 8), -- The Odyssey: Viễn tưởng, Phiêu lưu
(5, 1), (5, 7), -- Midnight Run: Hành động, Tâm lý
(6, 1), (6, 2), -- Lật Mặt 8: Hành động, Hài
(7, 1), (7, 5), -- Avengers: Hành động, Viễn tưởng
(8, 6), (8, 2); -- Inside Out 3: Hoạt hình, Hài
GO
-- ═══════════════════ LỊCH CHIẾU ═══════════════════
DECLARE @Today DATE = GETDATE();
INSERT INTO Showtimes (MovieID, RoomID, StartTime, EndTime, BasePrice, Status) VALUES
-- Ngày hôm nay
(1, 1, DATEADD(hour, 9,  CAST(@Today AS DATETIME)), DATEADD(hour, 11, CAST(@Today AS DATETIME)), 85000,  'active'),
(1, 4, DATEADD(hour, 14, CAST(@Today AS DATETIME)), DATEADD(hour, 16, CAST(@Today AS DATETIME)), 90000,  'active'),
(2, 2, DATEADD(hour, 10, CAST(@Today AS DATETIME)), DATEADD(hour, 12, CAST(@Today AS DATETIME)), 90000,  'active'),
(2, 7, DATEADD(hour, 19, CAST(@Today AS DATETIME)), DATEADD(hour, 21, CAST(@Today AS DATETIME)), 120000, 'active'),
(3, 3, DATEADD(hour, 13, CAST(@Today AS DATETIME)), DATEADD(hour, 15, CAST(@Today AS DATETIME)), 75000,  'active'),
(4, 7, DATEADD(hour, 15, CAST(@Today AS DATETIME)), DATEADD(hour, 18, CAST(@Today AS DATETIME)), 120000, 'active'),
(5, 8, DATEADD(hour, 20, CAST(@Today AS DATETIME)), DATEADD(hour, 22, CAST(@Today AS DATETIME)), 95000,  'active'),
-- Ngày mai
(1, 1, DATEADD(hour, 33, CAST(@Today AS DATETIME)), DATEADD(hour, 35, CAST(@Today AS DATETIME)), 85000,  'active'),
(3, 2, DATEADD(hour, 34, CAST(@Today AS DATETIME)), DATEADD(hour, 36, CAST(@Today AS DATETIME)), 75000,  'active'),
(4, 3, DATEADD(hour, 38, CAST(@Today AS DATETIME)), DATEADD(hour, 41, CAST(@Today AS DATETIME)), 120000, 'active');
GO
-- ═══════════════════ ĐỒ ĂN & NƯỚC UỐNG ═══════════════════
INSERT INTO FoodBeverages (Name, Description, Category, Price, Stock, ImageURL, IsAvailable) VALUES
(N'Combo Solo',        N'1 Bắp ngọt nhỏ + 1 Nước ngọt lớn',        N'Combos',            55000,  200, 'images/default_poster.svg', 1),
(N'Combo Couple',      N'1 Bắp ngọt lớn + 2 Nước ngọt lớn',        N'Combos',            95000,  150, 'images/default_poster.svg', 1),
(N'Combo Family',      N'2 Bắp ngọt lớn + 4 Nước ngọt lớn',        N'Combos',            175000, 100, 'images/default_poster.svg', 1),
(N'Bắp Ngọt Lớn',     N'Bắp rang bơ caramel size lớn',             N'Bắp rang & Snack',  45000,  300, 'images/default_poster.svg', 1),
(N'Bắp Phô Mai',      N'Bắp rang rắc phô mai đặc biệt',           N'Bắp rang & Snack',  50000,  200, 'images/default_poster.svg', 1),
(N'Nachos Grande',     N'Nachos giòn kèm sốt phô mai và salsa',    N'Bắp rang & Snack',  60000,  80,  'images/default_poster.svg', 1),
(N'Coca-Cola Lớn',     N'Coca-Cola 500ml',                          N'Nước uống',         30000,  500, 'images/default_poster.svg', 1),
(N'Trà Đào Cam Sả',   N'Trà đào thanh mát vị cam và sả',          N'Nước uống',         35000,  300, 'images/default_poster.svg', 1),
(N'Nước Suối',         N'Nước suối tinh khiết 500ml',               N'Nước uống',         15000,  1000,'images/default_poster.svg', 1);
GO
-- ═══════════════════ MÃ KHUYẾN MÃI ═══════════════════
INSERT INTO Vouchers (Code, DiscountType, DiscountValue, MinOrderValue, MaxDiscount, UsageLimit, StartDate, EndDate, IsActive) VALUES
('GIAM20K',    'fixed',   20000, 100000, NULL,   100, GETDATE(), DATEADD(day, 30, GETDATE()), 1),
('GIAM10PT',   'percent', 10,    150000, 50000,  50,  GETDATE(), DATEADD(day, 30, GETDATE()), 1),
('WELCOME50',  'percent', 50,    200000, 100000, 200, GETDATE(), DATEADD(day, 60, GETDATE()), 1),
('HEQUA2025',  'fixed',   30000, 80000,  NULL,   500, GETDATE(), DATEADD(day, 90, GETDATE()), 1);
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

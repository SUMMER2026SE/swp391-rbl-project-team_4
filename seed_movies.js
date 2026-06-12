const { getPool, sql } = require('./config/db');

async function seed() {
  let pool;
  try {
    pool = await getPool();
    console.log('Starting seed process with SQL batches...');

    // Clear existing tables in correct order
    await pool.request().query(`
      IF OBJECT_ID('Ticket_FnB', 'U') IS NOT NULL DELETE FROM Ticket_FnB;
      IF OBJECT_ID('Retail_Order_FnB', 'U') IS NOT NULL DELETE FROM Retail_Order_FnB;
      IF OBJECT_ID('Inventory_FnB', 'U') IS NOT NULL DELETE FROM Inventory_FnB;
      IF OBJECT_ID('FoodBeverages', 'U') IS NOT NULL DELETE FROM FoodBeverages;
      IF OBJECT_ID('Tickets', 'U') IS NOT NULL DELETE FROM Tickets;
      IF OBJECT_ID('Booking_FnB', 'U') IS NOT NULL DELETE FROM Booking_FnB;
      IF OBJECT_ID('BookingTickets', 'U') IS NOT NULL DELETE FROM BookingTickets;
      IF OBJECT_ID('Bookings', 'U') IS NOT NULL DELETE FROM Bookings;
      IF OBJECT_ID('Reviews', 'U') IS NOT NULL DELETE FROM Reviews;
      IF OBJECT_ID('Showtimes', 'U') IS NOT NULL DELETE FROM Showtimes;
      IF OBJECT_ID('Seats', 'U') IS NOT NULL DELETE FROM Seats;
      IF OBJECT_ID('Rooms', 'U') IS NOT NULL DELETE FROM Rooms;
      IF OBJECT_ID('Cinemas', 'U') IS NOT NULL DELETE FROM Cinemas;
      IF OBJECT_ID('Movie_Genres', 'U') IS NOT NULL DELETE FROM Movie_Genres;
      IF OBJECT_ID('Genres', 'U') IS NOT NULL DELETE FROM Genres;
      IF OBJECT_ID('Movies', 'U') IS NOT NULL DELETE FROM Movies;
    `);
    console.log('Cleared existing movie and showtime tables.');

    // 1. Seed Genres
    const genres = [
      { id: 1, name: 'Hành động' },
      { id: 2, name: 'Hài hước' },
      { id: 3, name: 'Chính kịch' },
      { id: 4, name: 'Khoa học Viễn tưởng' },
      { id: 5, name: 'Kinh dị' },
      { id: 6, name: 'Hoạt hình' },
      { id: 7, name: 'Phiêu lưu' },
      { id: 8, name: 'Gia đình' },
      { id: 9, name: 'Tâm lý' },
      { id: 10, name: 'Hình sự' },
      { id: 11, name: 'Lãng mạn' },
      { id: 12, name: 'Giật gân' }
    ];

    let genreSql = 'SET IDENTITY_INSERT Genres ON;\n';
    genres.forEach(g => {
      genreSql += `INSERT INTO Genres (GenreID, GenreName) VALUES (${g.id}, N'${g.name}');\n`;
    });
    genreSql += 'SET IDENTITY_INSERT Genres OFF;\n';
    await pool.request().query(genreSql);
    console.log('Seeded Genres successfully.');

    // 2. Seed Movies
    const movies = [
      {
        id: 1,
        title: 'Doraemon Movie 45 (2026): Nobita Và Lâu Đài Dưới Đáy Biển',
        description: 'Bước vào kì nghỉ hè, Nobita và các bạn tranh cãi chí chóe về địa điểm cắm trại. Theo đề xuất của Doraemon, cả nhóm quyết định cắm trại giữa lòng đại dương! Sử dụng bảo bối thần kì “xe Buggy chạy dưới nước” và “đèn pin thích nghi”, 5 bạn nhỏ tận hưởng chuyến cắm trại dưới biển, gặp gỡ vô vàn sinh vật lí thú trên đường đi. Sau khi phát hiện một chiếc tàu đắm, nhóm bạn đã gặp chàng thanh niên bí ẩn El. Thật bất ngờ, anh ta lại là cư dân đáy biển, sống tại “liên bang Mu”, một vùng biển rộng lớn! Vốn căm ghét người mặt đất, cư dân đáy biển không thể nào tin tưởng Nobita và các bạn. Đúng lúc đó, lời thông báo “lâu đài quỷ… đã bắt đầu phục sinh!!” được truyền tới. “Lâu đài quỷ” khiến cư dân đáy biển khiếp sợ, rốt cuộc là gì? Đặt trọn niềm tin vào bè bạn trong lồng ngực, chuyến phiêu lưu vĩ đại quyết định số phận của trái đất, bắt đầu!',
        director: 'Tetsuo Yajima',
        duration: 101,
        rating: 'P',
        trailer: 'https://www.youtube.com/embed/u3JgYkmuK78',
        poster: 'images/doraemon_sea.png',
        status: 'now-showing',
        genres: [6, 8, 7]
      },
      {
        id: 2,
        title: 'Tạm Biệt Gohan',
        description: 'Bộ phim đầy xúc động về tình cảm gia đình và chú chó Gohan trung thành.',
        director: 'Unknown',
        duration: 105,
        rating: 'K',
        trailer: 'https://www.youtube.com/embed/97Wab-KewU4',
        poster: 'images/tam_biet_gohan.png',
        status: 'now-showing',
        genres: [8, 3]
      },
      {
        id: 3,
        title: 'Ngôi Đền Kỳ Quái 5',
        description: 'Phần tiếp theo của loạt phim hài kinh dị nổi tiếng Thái Lan về ngôi đền linh thiêng chứa đựng nhiều uẩn khúc.',
        director: 'Phontharis Chotkijsadarsopon',
        duration: 110,
        rating: 'T16',
        trailer: 'https://www.youtube.com/embed/9oZc6Wk0pBE',
        poster: 'images/ngoi_den_ky_quai_5.png',
        status: 'now-showing',
        genres: [2, 5]
      },
      {
        id: 4,
        title: 'Star Wars: Mandalorian và Grogu',
        description: 'Chuyến hành trình tiếp theo của thợ săn tiền thưởng Din Djarin và Grogu đáng yêu trong thiên hà xa xôi.',
        director: 'Jon Favreau',
        duration: 120,
        rating: 'T13',
        trailer: 'https://www.youtube.com/embed/aOC8E8z_ifw',
        poster: 'images/mandalorian_grogu.png',
        status: 'now-showing',
        genres: [1, 4]
      },
      {
        id: 5,
        title: 'Interstellar: Hành Trình Giữa Các Vì Sao',
        description: 'Chuyến hành trình xuyên qua hố đen vũ trụ để tìm kiếm một hành tinh mới có thể duy trì sự sống cho loài người.',
        director: 'Christopher Nolan',
        duration: 169,
        rating: 'T13',
        trailer: 'https://www.youtube.com/embed/zSWdZAIBEs4',
        poster: 'images/movie_interstellar.png',
        status: 'now-showing',
        genres: [3, 4]
      },
      {
        id: 6,
        title: 'Oppenheimer: Kẻ Hủy Diệt Thế Giới',
        description: 'Câu chuyện về cuộc đời của nhà vật lý lý thuyết J. Robert Oppenheimer, người lãnh đạo Dự án Manhattan chế tạo ra quả bom nguyên tử đầu tiên.',
        director: 'Christopher Nolan',
        duration: 180,
        rating: 'T18',
        trailer: 'https://www.youtube.com/embed/uYPbbEsQ21A',
        poster: 'images/movie_oppenheimer.png',
        status: 'now-showing',
        genres: [3]
      },
      {
        id: 7,
        title: 'Dune: Hành Tinh Cát - Phần 2',
        description: 'Paul Atreides hợp nhất với Chani và người Fremen khi đang trên con đường trả thù những kẻ đã hủy hoại gia đình anh. Đối mặt với sự lựa chọn giữa tình yêu của đời mình và số phận của vũ trụ, anh cố gắng ngăn chặn một tương lai.',
        director: 'Denis Villeneuve',
        duration: 166,
        rating: 'T13',
        trailer: 'https://www.youtube.com/embed/Way9Dexny3w',
        poster: 'images/dune_poster.png',
        status: 'now-showing',
        genres: [1, 4]
      },
      {
        id: 11,
        title: 'Lật Mặt 7: Một Điều Ước',
        description: 'Bộ phim đầy xúc cảm về gia đình của đạo diễn Lý Hải, xoay quanh câu chuyện của người mẹ tảo tần cả đời vì con cái và hành trình của những người con tìm về mái ấm gia đình ấm áp.',
        director: 'Lý Hải',
        duration: 138,
        rating: 'T13',
        trailer: 'https://www.youtube.com/embed/2Tz8aA0c0V0',
        poster: 'images/lat_mat_7.png',
        status: 'coming-soon',
        genres: [3, 8]
      },
      {
        id: 22,
        title: 'Deadpool & Wolverine',
        description: 'Cặp đôi phản anh hùng lầy lội và phá phách bậc nhất của vũ trụ điện ảnh Marvel cùng đồng hành trong một chuyến hành trình điên rồ xuyên thời gian để cứu lấy quê nhà của họ.',
        director: 'Shawn Levy',
        duration: 127,
        rating: 'T18',
        trailer: 'https://www.youtube.com/embed/73_1biulkIE',
        poster: 'images/deadpool_wolverine.png',
        status: 'coming-soon',
        genres: [1, 2, 4]
      },
      {
        id: 23,
        title: 'Inside Out 2',
        description: 'Hành trình trưởng thành mới của cô bé Riley với những cảm xúc mới xuất hiện trong bộ não của cô.',
        director: 'Kelsey Mann',
        duration: 96,
        rating: 'P',
        trailer: 'https://www.youtube.com/embed/LEjhYKPUtEs',
        poster: 'images/movie_summer_echoes.png',
        status: 'coming-soon',
        genres: [6, 8, 2]
      }
    ];

    let movieSql = 'SET IDENTITY_INSERT Movies ON;\n';
    movies.forEach(m => {
      // Escape single quotes in strings for SQL safety
      const escapedDesc = m.description.replace(/'/g, "''");
      const escapedTitle = m.title.replace(/'/g, "''");
      movieSql += `INSERT INTO Movies (MovieID, Title, Description, Director, Duration, AgeRating, TrailerURL, PosterURL, Status) VALUES (${m.id}, N'${escapedTitle}', N'${escapedDesc}', N'${m.director}', ${m.duration}, '${m.rating}', '${m.trailer}', '${m.poster}', '${m.status}');\n`;
    });
    movieSql += 'SET IDENTITY_INSERT Movies OFF;\n';
    await pool.request().query(movieSql);

    let genreLinkSql = '';
    movies.forEach(m => {
      m.genres.forEach(genreId => {
        genreLinkSql += `INSERT INTO Movie_Genres (MovieID, GenreID) VALUES (${m.id}, ${genreId});\n`;
      });
    });
    await pool.request().query(genreLinkSql);
    console.log('Seeded Movies and Movie_Genres successfully.');

    // 3. Seed Cinema
    let cinemaSql = `
      SET IDENTITY_INSERT Cinemas ON;
      INSERT INTO Cinemas (CinemaID, CinemaName, Address, City) VALUES (1, N'Cinema 04 - Diamond Plaza', N'34 Le Duan Street, District 1, HCM City', N'Hồ Chí Minh');
      SET IDENTITY_INSERT Cinemas OFF;
    `;
    await pool.request().query(cinemaSql);
    console.log('Seeded Cinemas successfully.');

    // 4. Seed Room
    let roomSql = `
      SET IDENTITY_INSERT Rooms ON;
      INSERT INTO Rooms (RoomID, CinemaID, RoomName, TotalSeats) VALUES (1, 1, N'Phòng 04', 60);
      SET IDENTITY_INSERT Rooms OFF;
    `;
    await pool.request().query(roomSql);
    console.log('Seeded Rooms successfully.');

    // 5. Seed Seats for Room 1
    // Rows A-F, Cols 1-10 (60 seats)
    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    let seatSql = 'SET IDENTITY_INSERT Seats ON;\n';
    let seatId = 1;
    for (const r of rows) {
      for (let c = 1; c <= 10; c++) {
        let seatType = 'standard';
        let multiplier = 1.0;
        if (r === 'E' || r === 'F') {
          seatType = 'vip';
          multiplier = 1.25;
        }
        seatSql += `INSERT INTO Seats (SeatID, RoomID, SeatRow, SeatNumber, SeatType, PriceMultiplier) VALUES (${seatId}, 1, '${r}', ${c}, '${seatType}', ${multiplier});\n`;
        seatId++;
      }
    }
    seatSql += 'SET IDENTITY_INSERT Seats OFF;\n';
    await pool.request().query(seatSql);
    console.log('Seeded Seats successfully.');

    // 6. Seed Showtimes for Movies today
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    
    const showtimes = [
      { id: 100, movieId: 7, startTime: `${todayStr} 09:45:00`, endTime: `${todayStr} 12:31:00` },
      { id: 101, movieId: 7, startTime: `${todayStr} 11:20:00`, endTime: `${todayStr} 14:06:00` },
      { id: 102, movieId: 7, startTime: `${todayStr} 14:00:00`, endTime: `${todayStr} 16:46:00` },
      { id: 103, movieId: 7, startTime: `${todayStr} 16:15:00`, endTime: `${todayStr} 19:01:00` },
      { id: 104, movieId: 7, startTime: `${todayStr} 19:30:00`, endTime: `${todayStr} 22:16:00` },
      { id: 105, movieId: 7, startTime: `${todayStr} 21:00:00`, endTime: `${todayStr} 23:46:00` },
      { id: 106, movieId: 1, startTime: `${todayStr} 10:00:00`, endTime: `${todayStr} 11:55:00` },
      { id: 107, movieId: 2, startTime: `${todayStr} 14:30:00`, endTime: `${todayStr} 16:15:00` }
    ];

    let showtimeSql = 'SET IDENTITY_INSERT Showtimes ON;\n';
    showtimes.forEach(st => {
      showtimeSql += `INSERT INTO Showtimes (ShowtimeID, MovieID, RoomID, StartTime, EndTime, BasePrice) VALUES (${st.id}, ${st.movieId}, 1, '${st.startTime}', '${st.endTime}', 85000);\n`;
    });
    showtimeSql += 'SET IDENTITY_INSERT Showtimes OFF;\n';
    await pool.request().query(showtimeSql);
    console.log('Seeded Showtimes successfully.');

    // 7. Seed FoodBeverages
    const fnbItems = [
      { id: 1, name: 'Combo Solo', description: '1 Bắp ngọt nhỏ + 1 Nước ngọt lớn', category: 'Combos', price: 55000, stock: 200, img: 'images/combo_solo.png', available: 1 },
      { id: 2, name: 'Combo Couple', description: '1 Bắp ngọt lớn + 2 Nước ngọt lớn', category: 'Combos', price: 95000, stock: 150, img: 'images/combo_couple.png', available: 1 },
      { id: 3, name: 'Combo Family', description: '2 Bắp ngọt lớn + 4 Nước ngọt lớn', category: 'Combos', price: 175000, stock: 100, img: 'images/combo_mega.png', available: 1 },
      { id: 4, name: 'Bắp Ngọt Lớn', description: 'Bắp rang bơ caramel size lớn', category: 'Bắp rang & Snack', price: 45000, stock: 300, img: 'images/combo_popcorn.png', available: 1 },
      { id: 5, name: 'Bắp Phô Mai', description: 'Bắp rang rắc phô mai đặc biệt', category: 'Bắp rang & Snack', price: 50000, stock: 200, img: 'images/combo_popcorn.png', available: 1 },
      { id: 6, name: 'Nachos Grande', description: 'Nachos giòn kèm sốt phô mai và salsa', category: 'Bắp rang & Snack', price: 60000, stock: 80, img: 'images/combo_solo.png', available: 1 },
      { id: 7, name: 'Coca-Cola Lớn', description: 'Coca-Cola 500ml', category: 'Nước uống', price: 30000, stock: 500, img: 'images/combo_popcorn.png', available: 1 },
      { id: 8, name: 'Trà Đào Cam Sả', description: 'Trà đào thanh mát vị cam và sả', category: 'Nước uống', price: 35000, stock: 300, img: 'images/combo_popcorn.png', available: 1 },
      { id: 9, name: 'Nước Suối', description: 'Nước suối tinh khiết 500ml', category: 'Nước uống', price: 15000, stock: 1000, img: 'images/combo_popcorn.png', available: 1 }
    ];

    let fnbSql = 'SET IDENTITY_INSERT FoodBeverages ON;\n';
    fnbItems.forEach(item => {
      fnbSql += `INSERT INTO FoodBeverages (FnBID, Name, Description, Category, Price, Stock, ImageURL, IsAvailable) VALUES (${item.id}, N'${item.name}', N'${item.description}', N'${item.category}', ${item.price}, ${item.stock}, '${item.img}', ${item.available});\n`;
    });
    fnbSql += 'SET IDENTITY_INSERT FoodBeverages OFF;\n';
    await pool.request().query(fnbSql);
    console.log('Seeded FoodBeverages successfully.');

    console.log('DB Seed completed successfully! 🎉');
  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    if (pool) {
      await pool.close();
    }
    process.exit(0);
  }
}

seed();

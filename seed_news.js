const { getPool, sql } = require('./config/db');

async function seedNews() {
    try {
        const pool = await getPool();
        await pool.request().query(`
            DELETE FROM dbo.News;
            DELETE FROM dbo.NewsArticles;
            DELETE FROM dbo.Promotions;

            INSERT INTO dbo.News (Title, Summary, Thumbnail, Category, Status, BadgeLabel, Author, IsFeatured, SortOrder, PublishedAt) VALUES 
            (N'Doraemon Movie 45', N'Phần phim điện ảnh thứ 45 của chú mèo máy Doraemon đưa nhóm bạn Nobita phiêu lưu khám phá đại dương bao la.', 'images/doraemon_sea.png', 'News', 1, N'Tin Tức', 'Admin', 1, 1, GETDATE()), 
            (N'Student Monday', N'Đồng giá vé 2D chỉ 45.000đ cho Học Sinh Sinh Viên vào thứ Hai.', 'images/promo_student.png', 'Event', 1, N'Khuyến Mãi', 'Admin', 0, 2, GETDATE());

            INSERT INTO dbo.NewsArticles (Type, Title, Summary, ImageURL, BadgeLabel, Author, IsFeatured, IsActive, SortOrder, PublishedAt) VALUES
            ('news', N'Doraemon Movie 45', N'Phần phim điện ảnh thứ 45 của chú mèo máy Doraemon đưa nhóm bạn Nobita phiêu lưu khám phá đại dương bao la.', 'images/doraemon_sea.png', N'Tin Tức', 'Admin', 1, 1, 1, GETDATE()), 
            ('events', N'Student Monday', N'Đồng giá vé 2D chỉ 45.000đ cho Học Sinh Sinh Viên vào thứ Hai.', 'images/promo_student.png', N'Khuyến Mãi', 'Admin', 0, 1, 2, GETDATE());

            INSERT INTO dbo.Promotions (Title, Description, BadgeLabel, ImageURL, LinkURL, IsFeatured, IsActive, SortOrder) VALUES
            (N'Student Monday', N'Đồng giá vé 2D chỉ 45.000đ cho Học Sinh Sinh Viên vào thứ Hai.', N'HOT', 'images/promo_student.png', '#', 1, 1, 1),
            (N'Thành viên mới', N'Giảm 50% cho đơn từ 200k', N'NEW', 'images/promo_sweet_combo.png', '#', 0, 1, 2);
        `);
        console.log('Inserted dummy news & promotions successfully');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}
seedNews();

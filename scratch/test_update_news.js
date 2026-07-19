require('dotenv').config();
const { getPool } = require('../config/db');
const NewsModel = require('../models/newsModel');

async function testUpdate() {
  try {
    const pool = await getPool();
    const res = await pool.request().query('SELECT TOP 1 NewsID, Title, Category FROM dbo.News');
    if (res.recordset.length === 0) {
      console.log('Không có tin tức nào trong DB để test sửa.');
      process.exit(0);
    }
    const item = res.recordset[0];
    console.log('Đang test sửa tin tức với dữ liệu chuỗi (giống FormData):', item);

    // Mô phỏng req.body từ FormData gửi lên
    const updated = await NewsModel.updateArticle(item.NewsID, {
      title: item.Title,
      type: item.Category === 'Event' ? 'events' : 'news',
      summary: 'Mô phỏng tóm tắt ' + Date.now(),
      content: 'Mô phỏng nội dung',
      author: 'D-Cinema',
      publishedAt: '2026-07-14',
      badgeLabel: 'HOT',
      sortOrder: '0',
      isFeatured: 'false',
      isActive: 'true'
    });

    console.log('Kết quả sửa thành công:', updated);
    process.exit(0);
  } catch (err) {
    console.error('Lỗi khi sửa tin tức:', err);
    process.exit(1);
  }
}

testUpdate();

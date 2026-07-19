const NewsModel = require('../models/newsModel');
const NewsService = require('../services/newsService');

function imagePathFromFile(file) {
  return file ? `/images/${file.filename}` : '';
}

function articlePayload(req) {
  return {
    type: req.body.type,
    title: req.body.title,
    summary: req.body.summary,
    content: req.body.content,
    imageURL: imagePathFromFile(req.file) || req.body.imageURL,
    badgeLabel: req.body.badgeLabel,
    author: req.body.author,
    publishedAt: req.body.publishedAt,
    isFeatured: req.body.isFeatured,
    isActive: req.body.isActive,
    sortOrder: req.body.sortOrder,
  };
}

exports.getPublicArticles = async (req, res) => {
  try {
    const data = await NewsModel.getPublicArticles(req.query || {});
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[newsController] getPublicArticles:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.getAdminArticles = async (req, res) => {
  try {
    const data = await NewsModel.getAdminArticles();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[newsController] getAdminArticles:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

exports.createArticle = async (req, res) => {
  try {
    const data = await NewsModel.createArticle(articlePayload(req));
    res.status(201).json({ success: true, message: 'Đã tạo bài viết.', data });
  } catch (err) {
    console.error('[newsController] createArticle:', err.message);
    if (err.code === 'DUPLICATE_ARTICLE') {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(400).json({ success: false, message: 'Lỗi tạo bài: ' + err.message });
  }
};

exports.updateArticle = async (req, res) => {
  try {
    const data = await NewsModel.updateArticle(req.params.id, articlePayload(req));
    if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    res.json({ success: true, message: 'Đã cập nhật bài viết.', data });
  } catch (err) {
    console.error('[newsController] updateArticle:', err.message);
    if (err.code === 'DUPLICATE_ARTICLE') {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(400).json({ success: false, message: 'Lỗi cập nhật: ' + err.message });
  }
};

exports.deleteArticle = async (req, res) => {
  try {
    const ok = await NewsModel.deleteArticle(req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    res.json({ success: true, message: 'Đã xóa bài viết.' });
  } catch (err) {
    console.error('[newsController] deleteArticle:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi xóa bài: ' + err.message });
  }
};

exports.toggleArticleActive = async (req, res) => {
  try {
    const data = await NewsModel.toggleArticleActive(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    res.json({ success: true, message: 'Đã đổi trạng thái bài viết.', data });
  } catch (err) {
    console.error('[newsController] toggleArticleActive:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi ẩn/hiện bài: ' + err.message });
  }
};

// --- UC06 - News and Events Management ---
exports.getNews = async (req, res) => {
  try {
    const result = await NewsService.getPublicNews(req.query);
    res.json({
      success: true,
      page: result.page,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
      data: result.data
    });
  } catch (err) {
    console.error('[newsController] getNews error:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
};

exports.getNewsById = async (req, res) => {
  try {
    const news = await NewsService.getNewsById(req.params.id);
    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      });
    }
    res.json({
      success: true,
      data: news
    });
  } catch (err) {
    console.error('[newsController] getNewsById error:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
};

const NewsModel = require('../models/newsModel');

class NewsService {
  static async getPublicNews(queryParams) {
    let { page, limit, category, search } = queryParams || {};

    // 1. Process and validate pagination parameters
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    if (isNaN(page) || page <= 0) page = 1;
    if (isNaN(limit) || limit <= 0) limit = 10;
    if (limit > 100) limit = 100; // prevent excessive page sizes

    // 2. Validate and standardize category filter
    if (category) {
      category = String(category).trim();
      const validCategories = ['News', 'Event', 'Promotion'];
      const matched = validCategories.find(c => c.toLowerCase() === category.toLowerCase());
      category = matched || null; // ignore filter if category is invalid
    }

    if (search) {
      search = String(search).trim();
    }

    // 3. Query news articles from the model
    const result = await NewsModel.getNewsPublic({
      search,
      category,
      page,
      limit
    });

    const totalPages = Math.ceil(result.totalItems / limit);

    return {
      page,
      totalItems: result.totalItems,
      totalPages,
      data: result.data
    };
  }

  static async getNewsById(id) {
    return await NewsModel.getNewsById(id);
  }
}

module.exports = NewsService;

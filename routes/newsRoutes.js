const express = require('express');
const router = express.Router();
const newsCtrl = require('../controllers/newsController');

// GET /api/news - Get published news with filters, search, and pagination
router.get('/', newsCtrl.getNews);

// GET /api/news/:id - Get detailed information for a specific news article
router.get('/:id', newsCtrl.getNewsById);

module.exports = router;

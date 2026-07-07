const express = require('express');
const router = express.Router();
const newsCtrl = require('../controllers/newsController');

router.get('/', newsCtrl.getPublicArticles);

module.exports = router;

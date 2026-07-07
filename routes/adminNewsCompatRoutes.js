const express = require('express');
const multer = require('multer');
const path = require('path');
const newsCtrl = require('../controllers/newsController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'public/images/');
  },
  filename(req, file, cb) {
    cb(null, 'news_' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

router.use(verifyToken, isSuperAdmin);
router.get('/news', newsCtrl.getAdminArticles);
router.post('/news', upload.single('image'), newsCtrl.createArticle);
router.put('/news/:id', upload.single('image'), newsCtrl.updateArticle);
router.delete('/news/:id', newsCtrl.deleteArticle);
router.patch('/news/:id/toggle', newsCtrl.toggleArticleActive);

module.exports = router;

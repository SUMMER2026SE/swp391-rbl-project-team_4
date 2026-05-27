// ============================================================
//  routes/userRoutes.js  –  User Profile API Endpoints
// ============================================================
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { getProfile, updateProfile, updatePassword } = require('../controllers/userController');

// Tất cả API ở đây đều yêu cầu đăng nhập (có token)
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────
// GET /api/users/profile
// ─────────────────────────────────────────────────────────────
router.get('/profile', getProfile);

// ─────────────────────────────────────────────────────────────
// PUT /api/users/profile
// Body: { fullName, phone, dateOfBirth, address }
// ─────────────────────────────────────────────────────────────
router.put('/profile', updateProfile);

// ─────────────────────────────────────────────────────────────
// PUT /api/users/password
// Body: { oldPassword, newPassword }
// ─────────────────────────────────────────────────────────────
router.put('/password', updatePassword);

// ─────────────────────────────────────────────────────────────
// POST /api/users/avatar
// ─────────────────────────────────────────────────────────────
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/avatars/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + req.user.userId + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const { uploadAvatar } = require('../controllers/userController');
router.post('/avatar', upload.single('avatar'), uploadAvatar);

module.exports = router;

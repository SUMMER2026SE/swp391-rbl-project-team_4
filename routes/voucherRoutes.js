const express = require('express');
const router = express.Router();
const voucherCtrl = require('../controllers/voucherController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../public/images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'voucher_' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Protect all voucher endpoints with admin token verification
router.use(verifyToken, isSuperAdmin);

// Voucher REST endpoints
router.get('/', voucherCtrl.getAllVouchers);
router.get('/:id', voucherCtrl.getVoucherById);
router.post('/upload', (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error('[voucherRoutes] Upload error:', err);
            return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lưu file ảnh: ' + err.message });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn một file ảnh.' });
        }
        const imageUrl = 'images/' + req.file.filename;
        res.json({ success: true, imageUrl: imageUrl });
    });
});
router.post('/', voucherCtrl.createVoucher);
router.put('/:id', voucherCtrl.updateVoucher);
router.delete('/:id', voucherCtrl.deleteVoucher);

module.exports = router;

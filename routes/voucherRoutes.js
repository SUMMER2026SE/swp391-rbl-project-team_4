const express = require('express');
const router = express.Router();
const voucherCtrl = require('../controllers/voucherController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// Protect all voucher endpoints with admin token verification
router.use(verifyToken, isSuperAdmin);

// Voucher REST endpoints
router.get('/', voucherCtrl.getAllVouchers);
router.get('/:id', voucherCtrl.getVoucherById);
router.post('/', voucherCtrl.createVoucher);
router.put('/:id', voucherCtrl.updateVoucher);
router.delete('/:id', voucherCtrl.deleteVoucher);

module.exports = router;

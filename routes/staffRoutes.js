const express = require('express');
const router = express.Router();
const staffCtrl = require('../controllers/staffController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, isSuperAdmin);

router.get('/showtimes/today', staffCtrl.getTodayShowtimes);
router.get('/showtimes/:showtimeId/seats', staffCtrl.getSeatsForSale);
router.post('/sell-ticket', staffCtrl.sellTicketAtCounter);
router.post('/check-ticket', staffCtrl.checkTicket);

module.exports = router;

// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// GET  /api/bookings/showtimes/:movieId
router.get('/showtimes/:movieId', bookingController.getShowtimes);

// GET  /api/bookings/seats/:showtimeId
router.get('/seats/:showtimeId', bookingController.getSeats);

// POST /api/bookings
router.post('/', bookingController.createBooking);

module.exports = router;

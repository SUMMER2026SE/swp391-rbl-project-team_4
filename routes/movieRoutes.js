// routes/movieRoutes.js
const express = require('express');
const router = express.Router();
const movieController = require('../controllers/movieController');

// GET /api/movies/now-showing
router.get('/now-showing', movieController.getNowShowing);

// GET /api/movies/coming-soon
router.get('/coming-soon', movieController.getComingSoon);

// GET /api/movies/:id
router.get('/:id', movieController.getMovieById);

module.exports = router;

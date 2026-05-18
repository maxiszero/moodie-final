// @ts-nocheck
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { joinMoodNeighbors, getMoodNeighbors } = require('../controllers/moodNeighborsController');

router.post('/join', protect, joinMoodNeighbors);
router.get('/', protect, getMoodNeighbors);

module.exports = router;

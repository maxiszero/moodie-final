// @ts-nocheck
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { aiTipLimiter } = require('../middleware/rateLimit');
const { suggestMoodSongsHandler } = require('../controllers/moodSongController');

router.post('/suggest', protect, aiTipLimiter, suggestMoodSongsHandler);

module.exports = router;

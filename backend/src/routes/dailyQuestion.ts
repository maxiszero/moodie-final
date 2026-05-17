// @ts-nocheck
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/optionalAuth');
const { getToday, getAnonymousAnswers, postAnswer, getMyHistory } = require('../controllers/dailyQuestionController');

router.get('/today', optionalAuth, getToday);
router.get('/me/history', protect, getMyHistory);
router.get('/answers', optionalAuth, getAnonymousAnswers);
router.post('/answer', protect, postAnswer);

module.exports = router;

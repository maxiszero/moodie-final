// @ts-nocheck
const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getMe,
  telegramWebAppLogin,
  linkTelegram,
  unlinkTelegram,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/telegram/webapp-login', authLimiter, telegramWebAppLogin);
router.get('/me', protect, getMe);
router.post('/telegram/link', protect, linkTelegram);
router.delete('/telegram/unlink', protect, unlinkTelegram);

module.exports = router;
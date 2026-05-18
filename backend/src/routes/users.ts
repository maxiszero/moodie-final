// @ts-nocheck
const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 } });
const { protect } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/optionalAuth');
const {
  searchUsers,
  getUserByUsername,
  getFollowers,
  getFollowing,
  followUser,
  unfollowUser,
  updatePassword,
  updateSettings,
  getTelegramSettings,
  updateTelegramSettings,
  blockUser,
  getMoodHeatmap,
  getActivityStreak,
  exportSettingsCsv,
  importSettingsCsv,
  getBlockedUsers,
  unblockUser,
} = require('../controllers/userController');

router.patch('/me/password', protect, updatePassword);
router.patch('/me/settings', protect, updateSettings);
router.get('/me/streak', protect, getActivityStreak);
router.get('/me/settings/export', protect, exportSettingsCsv);
router.post('/me/settings/import', protect, upload.single('file'), importSettingsCsv);
router.get('/me/blocked', protect, getBlockedUsers);
router.delete('/me/blocked/:username', protect, unblockUser);
router.get('/me/telegram-settings', protect, getTelegramSettings);
router.patch('/me/telegram-settings', protect, updateTelegramSettings);
router.get('/search', optionalAuth, searchUsers);
router.get('/:username/followers', optionalAuth, getFollowers);
router.get('/:username/following', optionalAuth, getFollowing);
router.post('/:username/follow', protect, followUser);
router.delete('/:username/follow', protect, unfollowUser);
router.post('/:username/block', protect, blockUser);
router.get('/:username/heatmap', optionalAuth, getMoodHeatmap);
router.get('/:username', optionalAuth, getUserByUsername);

module.exports = router;

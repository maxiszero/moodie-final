// @ts-nocheck
const express = require('express');
const router = express.Router();
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
  getMoodHeatmap
} = require('../controllers/userController');

router.patch('/me/password', protect, updatePassword);
router.patch('/me/settings', protect, updateSettings);
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

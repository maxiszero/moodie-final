// @ts-nocheck
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { getAdminUsers, getAdminPosts, setUserBan } = require('../controllers/adminController');

router.use(protect, requireAdmin);

router.get('/users', getAdminUsers);
router.get('/posts', getAdminPosts);
router.patch('/users/:userId/ban', setUserBan);

module.exports = router;

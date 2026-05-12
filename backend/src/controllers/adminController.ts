// @ts-nocheck
const User = require('../models/User');
const Post = require('../models/Post');

const getAdminUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(500);
    res.json(users);
  } catch (error) {
    next(error);
  }
};

const getAdminPosts = async (req, res, next) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(300)
      .populate('userId', 'username currentEmotion banned');
    res.json(posts);
  } catch (error) {
    next(error);
  }
};

const setUserBan = async (req, res, next) => {
  try {
    const { banned } = req.body;
    if (typeof banned !== 'boolean') {
      return res.status(400).json({ message: 'Field "banned" (boolean) is required' });
    }
    const target = await User.findById(req.params.userId);
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot ban yourself' });
    }
    if (target.role === 'admin') {
      return res.status(400).json({ message: 'Cannot ban an administrator' });
    }
    target.banned = banned;
    await target.save();

    // Refresh cache
    if (req.refreshBannedUsers) {
      await req.refreshBannedUsers();
    }

    res.json({
      _id: target._id,
      username: target.username,
      banned: target.banned,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminUsers,
  getAdminPosts,
  setUserBan,
};

// @ts-nocheck
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Post = require('../models/Post');
const { summarizeWeeklyMood } = require('../utils/aiAnalyzer');
const { notifyTelegramUser } = require('../utils/telegramNotify');

const publicUserFields =
  'username currentEmotion currentEmoji currentColor currentColor2 currentColor3 createdAt';

const WEEKLY_SUMMARY_CACHE_MS = 12 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function langOf(user) {
  return user?.preferredLanguage === 'en' ? 'en' : 'ru';
}

function validateNewPassword(password) {
  if (!password || typeof password !== 'string') return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (password.length > 72) return 'Password is too long';
  return null;
}

async function resolveWeeklyAiSummary(userDoc) {
  const weekAgo = new Date(Date.now() - WEEK_MS);
  const weekPosts = await Post.find({ userId: userDoc._id, createdAt: { $gte: weekAgo } })
    .sort({ createdAt: -1 })
    .select('text emotion emoji createdAt')
    .limit(80)
    .lean();

  if (!weekPosts.length) {
    return '';
  }

  const lang = userDoc.preferredLanguage === 'en' ? 'en' : 'ru';
  const cachedAt = userDoc.weeklyAiSummaryAt ? new Date(userDoc.weeklyAiSummaryAt).getTime() : 0;
  const cached = typeof userDoc.weeklyAiSummary === 'string' ? userDoc.weeklyAiSummary.trim() : '';
  const cacheOk =
    cached &&
    cachedAt &&
    Date.now() - cachedAt < WEEKLY_SUMMARY_CACHE_MS;

  if (cacheOk) {
    return cached;
  }

  const summaryText = (await summarizeWeeklyMood(weekPosts, lang)) || '';
  await User.findByIdAndUpdate(userDoc._id, {
    weeklyAiSummary: summaryText,
    weeklyAiSummaryAt: new Date(),
  });

  return summaryText;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** List users by username substring (for nav search). Excludes banned. */
const searchUsers = async (req, res, next) => {
  try {
    const raw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (raw.length < 2) {
      return res.json([]);
    }
    if (raw.length > 32) {
      return res.status(400).json({ message: 'Query too long' });
    }
    const pattern = escapeRegex(raw);
    const re = new RegExp(pattern, 'i');
    const users = await User.find({
      username: re,
      banned: { $ne: true },
    })
      .select(publicUserFields)
      .sort({ username: 1 })
      .limit(12)
      .lean();
    res.json(users);
  } catch (error) {
    next(error);
  }
};

const getUserByUsername = async (req, res, next) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({ username }).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const viewerId = req.user?._id?.toString();
    const isSelf = viewerId && user._id.toString() === viewerId;
    const isAdminViewer = req.user?.role === 'admin';
    if (user.banned && !isSelf && !isAdminViewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    let userFollowing = [];
    if (req.user) {
      const me = await User.findById(req.user._id).select('following');
      userFollowing = me.following.map(id => id.toString());
    }

    const [posts, likesAgg, followersCount, weeklyAiSummary] = await Promise.all([
      Post.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .populate('userId', 'username currentEmotion currentEmoji currentColor currentColor2 currentColor3'),
      Post.aggregate([
        { $match: { userId: user._id } },
        { $group: { _id: null, total: { $sum: '$likes' } } }
      ]),
      User.countDocuments({ following: user._id }),
      resolveWeeklyAiSummary(user)
    ]);

    const postsWithFollowInfo = posts.map(post => {
      const postObj = post.toObject();
      const authorId = post.userId && (post.userId._id || post.userId) ? (post.userId._id || post.userId).toString() : null;
      postObj.isFollowingAuthor = authorId ? userFollowing.includes(authorId) : false;
      return postObj;
    });

    const totalLikesReceived = likesAgg[0]?.total ?? 0;
    const followingCount = user.following?.length ?? 0;

    let isFollowing = false;
    if (viewerId && user._id.toString() !== viewerId) {
      isFollowing = userFollowing.includes(user._id.toString());
    }

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        weeklyAiSummary: weeklyAiSummary || '',
        currentEmotion: user.currentEmotion || 'neutral',
        currentEmoji: user.currentEmoji || '😐',
        currentColor: user.currentColor || '#9E9E9E',
        currentColor2: user.currentColor2 || '#757575',
        currentColor3: user.currentColor3 || '#616161',
        createdAt: user.createdAt
      },
      posts: postsWithFollowInfo,
      followersCount,
      followingCount,
      totalLikesReceived,
      isFollowing
    });
  } catch (error) {
    next(error);
  }
};

const getFollowers = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('_id banned username');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const viewerId = req.user?._id?.toString();
    const isSelf = viewerId && user._id.toString() === viewerId;
    const isAdminViewer = req.user?.role === 'admin';
    if (user.banned && !isSelf && !isAdminViewer) {
      return res.status(404).json({ message: 'User not found' });
    }
    const followers = await User.find({ following: user._id })
      .select(publicUserFields)
      .sort({ username: 1 });
    res.json(followers);
  } catch (error) {
    next(error);
  }
};

const getFollowing = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('following banned _id username')
      .populate('following', publicUserFields);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const viewerId = req.user?._id?.toString();
    const isSelf = viewerId && user._id.toString() === viewerId;
    const isAdminViewer = req.user?.role === 'admin';
    if (user.banned && !isSelf && !isAdminViewer) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(Array.isArray(user.following) ? user.following : []);
  } catch (error) {
    next(error);
  }
};

const followUser = async (req, res, next) => {
  try {
    const target = await User.findOne({ username: req.params.username });
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (target.banned) {
      return res.status(400).json({ message: 'Cannot follow this user' });
    }
    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const me = await User.findById(req.user._id);
    if (!me.following) me.following = [];
    const already = me.following.some((id) => id.toString() === target._id.toString());
    if (already) {
      return res.status(400).json({ message: 'Already following' });
    }

    me.following.push(target._id);
    await me.save();

    notifyTelegramUser(
      target,
      langOf(target) === 'en'
        ? `${me.username} followed you on Moodie.`
        : `${me.username} подписался на вас в Moodie.`,
      'follow',
    );

    const followersCount = await User.countDocuments({ following: target._id });
    res.json({ message: 'Followed', isFollowing: true, followersCount });
  } catch (error) {
    next(error);
  }
};

const unfollowUser = async (req, res, next) => {
  try {
    const target = await User.findOne({ username: req.params.username });
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    const me = await User.findById(req.user._id);
    if (!me.following) me.following = [];
    me.following = me.following.filter((id) => id.toString() !== target._id.toString());
    await me.save();

    const followersCount = await User.countDocuments({ following: target._id });
    res.json({ message: 'Unfollowed', isFollowing: false, followersCount });
  } catch (error) {
    next(error);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const err = validateNewPassword(newPassword);
    if (err) return res.status(400).json({ message: err });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const { preferredLanguage, preferredTheme } = req.body;
    const updates = {};
    if (preferredLanguage === 'ru' || preferredLanguage === 'en') {
      updates.preferredLanguage = preferredLanguage;
    }
    if (preferredTheme === 'light' || preferredTheme === 'dark') {
      updates.preferredTheme = preferredTheme;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid settings provided' });
    }

    const existing = await User.findById(req.user._id).select('preferredLanguage');
    if (
      updates.preferredLanguage &&
      existing &&
      existing.preferredLanguage !== updates.preferredLanguage
    ) {
      updates.weeklyAiSummary = '';
      updates.weeklyAiSummaryAt = null;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select(
      '-password'
    );

    res.json({
      preferredLanguage: user.preferredLanguage,
      preferredTheme: user.preferredTheme
    });
  } catch (error) {
    next(error);
  }
};

const blockUser = async (req, res, next) => {
  try {
    const target = await User.findOne({ username: req.params.username });
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (target._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    const me = await User.findById(req.user.id);
    if (!me.blockedUsers.some(id => id.toString() === target._id.toString())) {
      me.blockedUsers.push(target._id);
      // Automatically unfollow when blocking
      me.following = me.following.filter(id => id.toString() !== target._id.toString());
      await me.save();
    }

    res.json({ message: 'User blocked' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Mood Heatmap data for user
// @route   GET /api/users/:username/heatmap
// @access  Public
const getMoodHeatmap = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Last 365 days
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const heatmap = await Post.aggregate([
      { 
        $match: { 
          userId: user._id,
          createdAt: { $gte: oneYearAgo }
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          dominantColor: { $first: "$color" },
          emotions: { 
            $push: { 
              emotion: "$emotion", 
              emoji: "$emoji",
              color: "$color"
            } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.json(heatmap);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchUsers,
  getUserByUsername,
  getFollowers,
  getFollowing,
  followUser,
  unfollowUser,
  updatePassword,
  updateSettings,
  blockUser,
  getMoodHeatmap
};

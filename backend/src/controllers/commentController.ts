// @ts-nocheck
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const User = require('../models/User');
const { notifyTelegramUser } = require('../utils/telegramNotify');

const publicAuthorFields = 'username currentEmoji currentColor currentColor2 currentColor3';

const linkRegex = /(https?:\/\/\S+|www\.\S+)/gi;

async function excludedAuthorIds(req) {
  const banned = (req.bannedUserIds || []).map((id) => id.toString());
  const set = new Set(banned);
  if (req.user) {
    const u = await User.findById(req.user.id).select('blockedUsers');
    if (u && u.blockedUsers && u.blockedUsers.length > 0) {
      u.blockedUsers.forEach((id) => set.add(id.toString()));
    }
  }
  return [...set];
}

// @route   GET /api/posts/:id/comments
// @access  Public
const getComments = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).select('_id hidden');
    if (!post || post.hidden) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const ex = await excludedAuthorIds(req);
    const query = {
      postId: post._id,
      hidden: { $ne: true },
      ...(ex.length ? { userId: { $nin: ex } } : {}),
    };
    const rows = await Comment.find(query)
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('userId', publicAuthorFields)
      .lean();
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/posts/:id/comments
// @access  Private
const addComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.hidden) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      return res.status(400).json({ message: 'Comment text is required' });
    }
    if (text.length > 500) {
      return res.status(400).json({ message: 'Comment is too long' });
    }
    if (linkRegex.test(text)) {
      return res.status(400).json({ message: 'Links are not allowed in comments' });
    }

    const author = await User.findById(req.user._id).select('banned');
    if (!author || author.banned) {
      return res.status(403).json({ message: 'Cannot comment' });
    }

    const comment = await Comment.create({
      postId: post._id,
      userId: req.user._id,
      text,
    });
    await Post.updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } });

    const populated = await Comment.findById(comment._id).populate('userId', publicAuthorFields).lean();
    if (post.userId.toString() !== req.user._id.toString()) {
      const owner = await User.findById(post.userId).select(
        'telegramDailyNotify telegramActivityNotify telegramChatId telegramUserId preferredLanguage banned lastTelegramActivityNotifyAt',
      );
      if (owner && !owner.banned) {
        notifyTelegramUser(
          owner,
          owner.preferredLanguage === 'en'
            ? `${req.user.username} commented on your post on Moodie.`
            : `${req.user.username} прокомментировал ваш пост в Moodie.`,
          'comment',
        );
      }
    }
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/posts/:id/comments/:commentId
// @access  Private
const deleteComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).select('_id');
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const comment = await Comment.findOne({ _id: req.params.commentId, postId: post._id });
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    const own = comment.userId.toString() === req.user._id.toString();
    const admin = req.user.role === 'admin';
    if (!own && !admin) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }
    await Comment.deleteOne({ _id: comment._id });
    await Post.updateOne({ _id: post._id }, { $inc: { commentsCount: -1 } });
    await Post.updateOne({ _id: post._id, commentsCount: { $lt: 0 } }, { $set: { commentsCount: 0 } });
    res.json({ message: 'Comment deleted', id: comment._id.toString() });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getComments,
  addComment,
  deleteComment,
};

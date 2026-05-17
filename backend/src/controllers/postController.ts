// @ts-nocheck
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const { analyzeEmotion, pickMoodSong } = require('../utils/aiAnalyzer');
const { paletteForEmotion, normalizeEmotion } = require('../config/emotionPalette');
const { notifyTelegramUser, notifyTelegramUsers } = require('../utils/telegramNotify');
const { notifyInAppUser, notifyInAppUsers } = require('../utils/inAppNotify');

function langOf(user) {
  return user?.preferredLanguage === 'en' ? 'en' : 'ru';
}

function msg(user, ru, en) {
  return langOf(user) === 'en' ? en : ru;
}

/** One-time: older posts had no feedSortScore until first save / migration. */
let feedSortBackfillScheduled = false;
function scheduleFeedSortBackfill() {
  if (feedSortBackfillScheduled) return;
  feedSortBackfillScheduled = true;
  setImmediate(async () => {
    try {
      const r = await Post.collection.updateMany(
        { feedSortScore: { $exists: false } },
        [
          {
            $set: {
              feedQuality: { $ifNull: ['$feedQuality', 65] },
              feedSortScore: {
                $subtract: [
                  { $toLong: '$createdAt' },
                  {
                    $multiply: [
                      { $subtract: [100, { $ifNull: ['$feedQuality', 65] }] },
                      180000,
                    ],
                  },
                ],
              },
            },
          },
        ],
      );
      if (r.modifiedCount > 0) {
        console.log(`feedSortScore backfill: updated ${r.modifiedCount} post(s)`);
      }
    } catch (e) {
      feedSortBackfillScheduled = false;
      console.error('feedSortScore backfill:', e.message);
    }
  });
}

// @desc    Get all posts
// @route   GET /api/posts?sort=latest|trending&emotion=xxx&moodMix=1
// @access  Public
const getPosts = async (req, res, next) => {
  try {
    scheduleFeedSortBackfill();

    const sortMode = req.query.sort === 'trending' ? 'trending' : 'latest';
    const emotionFilter = req.query.emotion;
    const moodMix = String(req.query.moodMix || '').trim() === '1';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const sortOption =
      sortMode === 'trending'
        ? { likes: -1, feedSortScore: -1, createdAt: -1 }
        : { feedSortScore: -1, createdAt: -1 };

    const bannedIds = req.bannedUserIds || [];
    
    let query = { 
      userId: { $nin: bannedIds },
      hidden: { $ne: true }
    };

    // Filter out posts from blocked users if user is logged in
    if (req.user) {
      const user = await User.findById(req.user.id).select('blockedUsers');
      if (user && user.blockedUsers && user.blockedUsers.length > 0) {
        // Correctly merge banned and blocked IDs
        const blockedIds = user.blockedUsers.map(id => id.toString());
        const combinedExcludedIds = [...new Set([...bannedIds, ...blockedIds])];
        query.userId = { $nin: combinedExcludedIds };
      }
    }

    if (emotionFilter) {
      query.emotion = emotionFilter;
    }

    function stabilizersForEmotion(e) {
      const emo = normalizeEmotion(e);
      switch (emo) {
        case 'angry':
          return ['calmness', 'neutral', 'loved'];
        case 'anxious':
        case 'scared':
        case 'anxiety':
          return ['calmness', 'neutral', 'loved'];
        case 'sad':
        case 'melancholy':
        case 'apathy':
        case 'tired':
          return ['neutral', 'calmness', 'loved', 'inspiration'];
        default:
          return ['neutral', 'calmness'];
      }
    }

    function interleave(primary, stable) {
      const out = [];
      let i = 0;
      let j = 0;
      // target: ~70% primary, 30% stable → insert 1 stable every ~2 primary
      while (out.length < limit && (i < primary.length || j < stable.length)) {
        if (i < primary.length) out.push(primary[i++]);
        if (out.length >= limit) break;
        if (i < primary.length) out.push(primary[i++]);
        if (out.length >= limit) break;
        if (j < stable.length) out.push(stable[j++]);
      }
      while (out.length < limit && i < primary.length) out.push(primary[i++]);
      while (out.length < limit && j < stable.length) out.push(stable[j++]);
      return out;
    }

    let posts;
    const canMoodMix = Boolean(moodMix && req.user && !emotionFilter);
    if (!canMoodMix) {
      posts = await Post.find(query)
        .populate('userId', 'username currentEmotion currentEmoji currentColor currentColor2 currentColor3')
        .sort(sortOption)
        .skip(skip)
        .limit(limit);
    } else {
      const userEmotion = normalizeEmotion(req.user.currentEmotion || 'neutral');
      const stableEmotions = stabilizersForEmotion(userEmotion).filter((x) => x !== userEmotion);

      const primaryLimit = Math.max(1, Math.ceil(limit * 0.7));
      const stableLimit = Math.max(0, limit - primaryLimit);

      const primarySkip = (page - 1) * primaryLimit;
      const stableSkip = (page - 1) * stableLimit;

      const base = { ...query };
      const primaryQuery = { ...base, emotion: userEmotion };
      const stableQuery = stableLimit
        ? { ...base, emotion: { $in: stableEmotions } }
        : null;

      const [primaryRows, stableRows] = await Promise.all([
        Post.find(primaryQuery)
          .populate('userId', 'username currentEmotion currentEmoji currentColor currentColor2 currentColor3')
          .sort(sortOption)
          .skip(primarySkip)
          .limit(primaryLimit),
        stableQuery
          ? Post.find(stableQuery)
              .populate('userId', 'username currentEmotion currentEmoji currentColor currentColor2 currentColor3')
              .sort(sortOption)
              .skip(stableSkip)
              .limit(stableLimit)
          : Promise.resolve([]),
      ]);

      posts = interleave(primaryRows, stableRows);
    }

    // Add isFollowingAuthor field to each post
    let userFollowing = [];
    if (req.user) {
      const user = await User.findById(req.user.id).select('following');
      userFollowing = user.following.map(id => id.toString());
    }

    const postsWithFollowInfo = posts.map(post => {
      const postObj = post.toObject();
      const authorId = post.userId && (post.userId._id || post.userId) ? (post.userId._id || post.userId).toString() : null;
      postObj.isFollowingAuthor = authorId ? userFollowing.includes(authorId) : false;
      return postObj;
    });

    res.status(200).json(postsWithFollowInfo);
  } catch (error) {
    next(error);
  }
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// @desc    Search posts by text (substring)
// @route   GET /api/posts/search?q=...
// @access  Public
const searchPosts = async (req, res, next) => {
  try {
    const raw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (raw.length < 2) {
      return res.json([]);
    }
    if (raw.length > 64) {
      return res.status(400).json({ message: 'Query too long' });
    }
    const re = new RegExp(escapeRegex(raw), 'i');
    const bannedIds = req.bannedUserIds || [];
    const excluded = [...bannedIds];
    if (req.user) {
      const u = await User.findById(req.user.id).select('blockedUsers');
      if (u && u.blockedUsers && u.blockedUsers.length > 0) {
        u.blockedUsers.forEach((id) => excluded.push(id.toString()));
      }
    }
    const userIdNin = excluded.length
      ? [...new Set(excluded.map((x) => x.toString()))]
      : [];
    const query = {
      text: re,
      hidden: { $ne: true },
      ...(userIdNin.length ? { userId: { $nin: userIdNin } } : {}),
    };
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'username currentEmotion currentEmoji currentColor currentColor2 currentColor3')
      .lean();

    let userFollowing = [];
    if (req.user) {
      const u = await User.findById(req.user.id).select('following');
      userFollowing = (u && u.following ? u.following : []).map((id) => id.toString());
    }
    const out = posts.map((p) => {
      const author = p.userId;
      const authorId =
        author && typeof author === 'object' && author._id
          ? author._id.toString()
          : author
            ? String(author)
            : null;
      return {
        ...p,
        isFollowingAuthor: authorId ? userFollowing.includes(authorId) : false,
      };
    });
    res.json(out);
  } catch (error) {
    next(error);
  }
};

// @desc    Get mood statistics (Top 5 in last 24h)
// @route   GET /api/posts/stats/mood
// @access  Public
const getMoodStats = async (req, res, next) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stats = await Post.aggregate([
      { $match: { createdAt: { $gte: twentyFourHoursAgo } } },
      { $group: { _id: '$emotion', count: { $sum: 1 }, emoji: { $first: '$emoji' }, color: { $first: '$color' } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

// @desc    Create new post
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Please provide text for the post' });
    }

    if (text.length > 228) {
      return res.status(400).json({ message: 'Post text cannot exceed 228 characters' });
    }

    // Link validation
    const linkRegex = /(https?:\/\/\S+|www\.\S+)/gi;
    if (linkRegex.test(text)) {
      return res.status(400).json({ message: 'Links are not allowed in posts for security reasons' });
    }

    let { emotion, emoji, intensity, color, color2, color3, reasoning, tip, feedQuality } =
      await analyzeEmotion(text);

    // Enforce canonical palette by emotion so the UI remains consistent.
    const pal = paletteForEmotion(emotion);
    if (pal) {
      emotion = pal.emotion;
      color = pal.color;
      color2 = pal.color2;
      color3 = pal.color3;
    }

    const fq = typeof feedQuality === 'number' && !Number.isNaN(feedQuality) ? feedQuality : 65;
    const moodSong = await pickMoodSong({ emotion, text, lang: req.user?.preferredLanguage || 'ru' });

    const post = await Post.create({
      text,
      emotion,
      emoji,
      intensity,
      color,
      color2,
      color3,
      reasoning,
      tip,
      feedQuality: fq,
      userId: req.user.id,
    });

    await User.findByIdAndUpdate(req.user.id, {
      currentEmotion: emotion,
      currentEmoji: emoji,
      currentColor: color,
      currentColor2: color2,
      currentColor3: color3,
      weeklyAiSummary: '',
      weeklyAiSummaryAt: null,
      ...(moodSong || {}),
    });

    const populatedPost = await post.populate('userId', 'username currentEmotion currentEmoji currentColor currentColor2 currentColor3');
    
    const postObj = populatedPost.toObject();
    postObj.isFollowingAuthor = false; // Just created, and you can't follow yourself

    // Emit real-time event
    if (req.io) {
      req.io.emit('new_post', postObj);
    }

    const sameMoodFollowers = await User.find({
      following: req.user._id,
      _id: { $ne: req.user._id },
      currentEmotion: emotion,
      telegramActivityNotify: { $ne: false },
      banned: { $ne: true },
    }).select(
      'telegramDailyNotify telegramActivityNotify telegramChatId telegramUserId preferredLanguage lastTelegramActivityNotifyAt telegramTimezoneOffsetMinutes telegramQuietHoursEnabled telegramQuietStartHour telegramQuietEndHour',
    );
    notifyTelegramUsers(
      sameMoodFollowers,
      (u) => msg(
        u,
        `💭 ${req.user.username} сейчас чувствует то же, что и вы. Откройте Moodie, чтобы поддержать.`,
        `💭 ${req.user.username} feels the same as you right now. Open Moodie to support them.`,
      ),
      'same_mood',
    );
    notifyInAppUsers(
      req.io,
      sameMoodFollowers,
      (u) => msg(
        u,
        `💭 ${req.user.username} сейчас чувствует то же, что и вы. Откройте Moodie, чтобы поддержать.`,
        `💭 ${req.user.username} feels the same as you right now. Open Moodie to support them.`,
      ),
      'same_mood',
    );

    res.status(201).json(postObj);
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle like on a post
// @route   POST /api/posts/:id/like
// @access  Private
const toggleLike = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.user.id;
    const hasLiked = post.likedBy.includes(userId);

    if (hasLiked) {
      // Remove like
      post.likedBy = post.likedBy.filter(id => id.toString() !== userId);
      post.likes -= 1;
    } else {
      // Add like
      post.likedBy.push(userId);
      post.likes += 1;
    }

    await post.save();

    res.status(200).json({
      message: hasLiked ? 'Like removed' : 'Like added',
      likes: post.likes,
      likedBy: post.likedBy
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle reaction on a post
// @route   POST /api/posts/:id/reaction
// @access  Private
const toggleReaction = async (req, res, next) => {
  try {
    const { reactionType } = req.body;
    const validReactions = ['feel_this', 'stay_strong', 'hits_hard'];

    if (!validReactions.includes(reactionType)) {
      return res.status(400).json({ message: 'Invalid reaction type' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.user.id;
    const existingReactionIndex = post.reactions.findIndex(
      r => r.userId.toString() === userId && r.type === reactionType
    );

    if (existingReactionIndex > -1) {
      // Remove reaction
      post.reactions.splice(existingReactionIndex, 1);
    } else {
      // Add reaction (allow multiple different types from one user, but unique per type)
      post.reactions.push({ type: reactionType, userId });
    }

    await post.save();

    if (existingReactionIndex === -1 && post.userId.toString() !== userId) {
      const author = await User.findById(post.userId).select(
        'telegramDailyNotify telegramActivityNotify telegramChatId telegramUserId preferredLanguage banned lastTelegramActivityNotifyAt telegramTimezoneOffsetMinutes telegramQuietHoursEnabled telegramQuietStartHour telegramQuietEndHour',
      );
      if (author && !author.banned) {
        const text = msg(
          author,
          `💜 ${req.user.username} поддержал ваш пост в Moodie.`,
          `💜 ${req.user.username} supported your post on Moodie.`,
        );
        notifyTelegramUser(author, text, 'reaction');
        notifyInAppUser(req.io, author._id, text, 'reaction');
      }
    }

    res.status(200).json({
      message: existingReactionIndex > -1 ? 'Reaction removed' : 'Reaction added',
      reactions: post.reactions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete own post (or any post if admin)
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const owner = post.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!owner && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete your own posts' });
    }
    await Comment.deleteMany({ postId: req.params.id });
    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted', id: req.params.id });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle relatable on a post
// @route   POST /api/posts/:id/relatable
// @access  Private
const toggleRelatable = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.user.id;
    const index = post.relatableBy.findIndex(id => id.toString() === userId);

    if (index === -1) {
      post.relatableBy.push(userId);
      post.relatable += 1;
    } else {
      post.relatableBy.splice(index, 1);
      post.relatable -= 1;
    }

    await post.save();
    if (index === -1 && post.userId.toString() !== userId) {
      const author = await User.findById(post.userId).select(
        'telegramDailyNotify telegramActivityNotify telegramChatId telegramUserId preferredLanguage banned lastTelegramActivityNotifyAt telegramTimezoneOffsetMinutes telegramQuietHoursEnabled telegramQuietStartHour telegramQuietEndHour',
      );
      if (author && !author.banned) {
        const milestone = [3, 5, 10].includes(post.relatable) ? post.relatable : null;
        const type = milestone ? 'relatable_milestone' : 'relatable';
        const text = milestone
          ? msg(
              author,
              `✨ Ваш пост уже почувствовали ${milestone} раз. Вы не одни.`,
              `✨ Your post has been felt ${milestone} times. You are not alone.`,
            )
          : msg(
              author,
              `🤝 ${req.user.username} тоже почувствовал ваш пост в Moodie.`,
              `🤝 ${req.user.username} felt your post too on Moodie.`,
            );
        notifyTelegramUser(author, text, type);
        notifyInAppUser(req.io, author._id, text, type);
      }
    }
    res.json({ relatable: post.relatable, relatableBy: post.relatableBy });
  } catch (error) {
    next(error);
  }
};

// @desc    Report a post
// @route   POST /api/posts/:id/report
// @access  Private
const reportPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const userId = req.user.id;
    if (post.reportedBy.some(id => id.toString() === userId)) {
      return res.status(400).json({ message: 'Already reported' });
    }

    post.reportedBy.push(userId);
    post.reports += 1;

    if (post.reports >= 5) {
      post.hidden = true;
    }

    await post.save();
    res.json({ message: 'Post reported', reports: post.reports, hidden: post.hidden });
  } catch (error) {
    next(error);
  }
};

// @desc    Get AI Tip for draft text
// @route   POST /api/posts/ai/tip
// @access  Private
const getAiTip = async (req, res, next) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (!text.trim()) return res.status(400).json({ message: 'Text required' });
    if (text.length > 228) return res.status(400).json({ message: 'Text too long' });
    const { tip } = await analyzeEmotion(text, true);
    res.json({ tip });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPosts,
  getMoodStats,
  searchPosts,
  createPost,
  toggleLike,
  toggleReaction,
  toggleRelatable,
  reportPost,
  deletePost,
  getAiTip
};
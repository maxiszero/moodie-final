// @ts-nocheck
const DailyAnswer = require('../models/DailyAnswer');
const { utcDayKey, getMoodBucket, pickQuestion } = require('../utils/dailyQuestionPicker');

function resolveLang(user, queryLang) {
  const q = typeof queryLang === 'string' ? queryLang.toLowerCase() : '';
  if (q === 'en' || q === 'ru') return q;
  if (user && (user.preferredLanguage === 'en' || user.preferredLanguage === 'ru')) {
    return user.preferredLanguage;
  }
  return 'ru';
}

/**
 * GET /api/daily-question/today
 */
const getToday = async (req, res) => {
  try {
    const dayKey = utcDayKey();
    const lang = resolveLang(req.user, req.query.lang);

    if (!req.user) {
      const moodBucket = 'neutral';
      const question = pickQuestion(dayKey, moodBucket, lang);
      return res.json({
        dayKey,
        moodBucket,
        lang,
        question,
        hasAnswered: false,
        myAnswer: null,
        canAnswer: false,
      });
    }

    const existing = await DailyAnswer.findOne({
      userId: req.user._id,
      dayKey,
    }).lean();

    if (existing) {
      return res.json({
        dayKey,
        moodBucket: existing.moodBucket,
        lang: existing.lang,
        question: existing.questionText,
        hasAnswered: true,
        myAnswer: existing.text,
        canAnswer: true,
      });
    }

    const moodBucket = getMoodBucket(req.user.currentEmotion);
    const question = pickQuestion(dayKey, moodBucket, lang);

    return res.json({
      dayKey,
      moodBucket,
      lang,
      question,
      hasAnswered: false,
      myAnswer: null,
      canAnswer: true,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/**
 * GET /api/daily-question/answers?dayKey=&page=&limit=
 */
const getAnonymousAnswers = async (req, res) => {
  try {
    const dayKey =
      typeof req.query.dayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.dayKey)
        ? req.query.dayKey
        : utcDayKey();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const skip = (page - 1) * limit;

    const bannedIds = req.bannedUserIds || [];

    const query = { dayKey };
    if (bannedIds.length > 0) {
      query.userId = { $nin: bannedIds };
    }

    const [rows, total] = await Promise.all([
      DailyAnswer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).select('text createdAt').lean(),
      DailyAnswer.countDocuments(query),
    ]);

    res.json({
      dayKey,
      page,
      limit,
      total,
      answers: rows.map((r) => ({ text: r.text, createdAt: r.createdAt })),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/**
 * POST /api/daily-question/answer  { text }
 */
const postAnswer = async (req, res) => {
  try {
    if (req.user.banned) {
      return res.status(403).json({ message: 'Account banned' });
    }
    const raw = typeof req.body?.text === 'string' ? req.body.text : '';
    const text = raw.trim();
    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }
    if (text.length > 600) {
      return res.status(400).json({ message: 'Answer is too long (max 600 characters)' });
    }

    const linkRegex = /(https?:\/\/\S+|www\.\S+)/gi;
    if (linkRegex.test(text)) {
      return res.status(400).json({ message: 'Links are not allowed for security reasons' });
    }

    const dayKey = utcDayKey();
    const lang = resolveLang(req.user, req.query.lang);

    const existing = await DailyAnswer.findOne({ userId: req.user._id, dayKey });

    if (existing) {
      existing.text = text;
      await existing.save();
      const o = existing.toObject();
      return res.json({
        dayKey: o.dayKey,
        moodBucket: o.moodBucket,
        lang: o.lang,
        question: o.questionText,
        hasAnswered: true,
        myAnswer: o.text,
        canAnswer: true,
      });
    }

    const moodBucket = getMoodBucket(req.user.currentEmotion);
    const questionText = pickQuestion(dayKey, moodBucket, lang);

    const doc = await DailyAnswer.create({
      userId: req.user._id,
      dayKey,
      moodBucket,
      questionText,
      lang,
      text,
    });

    if (req.io) {
      req.io.emit('daily_answer', {
        dayKey,
        createdAt: doc.createdAt,
      });
    }

    res.status(201).json({
      dayKey: doc.dayKey,
      moodBucket: doc.moodBucket,
      lang: doc.lang,
      question: doc.questionText,
      hasAnswered: true,
      myAnswer: doc.text,
      canAnswer: true,
    });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ message: 'Already answered for this day' });
    }
    res.status(500).json({ message: e.message });
  }
};

const getMyHistory = async (req, res) => {
  try {
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 7));
    const rows = await DailyAnswer.find({ userId: req.user._id })
      .sort({ dayKey: -1, createdAt: -1 })
      .limit(limit)
      .select('dayKey moodBucket questionText lang text createdAt updatedAt')
      .lean();
    res.json({
      answers: rows.map((r) => ({
        dayKey: r.dayKey,
        moodBucket: r.moodBucket,
        question: r.questionText,
        lang: r.lang,
        text: r.text,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = {
  getToday,
  getAnonymousAnswers,
  postAnswer,
  getMyHistory,
};

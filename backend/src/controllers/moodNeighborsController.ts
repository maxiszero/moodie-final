// @ts-nocheck
const User = require('../models/User');
const Post = require('../models/Post');
const MoodNeighborPresence = require('../models/MoodNeighborPresence');
const { getMoodBucket } = require('../utils/dailyQuestionPicker');
const { normalizeEmotion } = require('../config/emotionPalette');

const PRESENCE_MS = 15 * 60 * 1000;
const POST_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const MAX_SNIPPETS = 12;

function emotionLabel(emotion, lang) {
  const labels = {
    ru: {
      happy: 'радость',
      sad: 'грусть',
      angry: 'злость',
      neutral: 'нейтральное',
      excited: 'воодушевление',
      tired: 'усталость',
      scared: 'страх',
      loved: 'любовь',
      inspiration: 'вдохновение',
      anxiety: 'тревога',
      anxious: 'тревога',
      drive: 'драйв',
      melancholy: 'меланхолия',
      calmness: 'спокойствие',
      apathy: 'апатия',
    },
    en: {
      happy: 'happy',
      sad: 'sad',
      angry: 'angry',
      neutral: 'neutral',
      excited: 'excited',
      tired: 'tired',
      scared: 'scared',
      loved: 'loved',
      inspiration: 'inspiration',
      anxiety: 'anxiety',
      anxious: 'anxious',
      drive: 'drive',
      melancholy: 'melancholy',
      calmness: 'calmness',
      apathy: 'apathy',
    },
  };
  const key = String(emotion || 'neutral').toLowerCase();
  return labels[lang === 'en' ? 'en' : 'ru'][key] || key;
}

async function blockedAndSelfIds(userId) {
  const me = await User.findById(userId).select('blockedUsers');
  const ids = new Set([String(userId)]);
  for (const id of me?.blockedUsers || []) ids.add(String(id));
  const blockedMe = await User.find({ blockedUsers: userId }).select('_id');
  for (const u of blockedMe) ids.add(String(u._id));
  return ids;
}

const joinMoodNeighbors = async (req, res, next) => {
  try {
    const emotion = normalizeEmotion(req.user.currentEmotion) || 'neutral';
    const bucket = getMoodBucket(emotion);
    const expiresAt = new Date(Date.now() + PRESENCE_MS);
    await MoodNeighborPresence.findOneAndUpdate(
      { userId: req.user._id },
      { emotion, bucket, expiresAt },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json({ ok: true, expiresAt: expiresAt.toISOString(), emotion, bucket });
  } catch (error) {
    next(error);
  }
};

const getMoodNeighbors = async (req, res, next) => {
  try {
    const lang = req.user.preferredLanguage === 'en' ? 'en' : 'ru';
    const emotion = normalizeEmotion(req.user.currentEmotion) || 'neutral';
    const bucket = getMoodBucket(emotion);
    const now = new Date();
    const exclude = await blockedAndSelfIds(req.user._id);

    await MoodNeighborPresence.findOneAndUpdate(
      { userId: req.user._id },
      { emotion, bucket, expiresAt: new Date(Date.now() + PRESENCE_MS) },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const baseQuery = { expiresAt: { $gt: now } };
    let matchMode = 'emotion';
    let peers = await MoodNeighborPresence.find({ ...baseQuery, emotion }).select('userId');
    peers = peers.filter((p) => !exclude.has(String(p.userId)));

    if (peers.length < 2) {
      matchMode = 'bucket';
      peers = await MoodNeighborPresence.find({ ...baseQuery, bucket }).select('userId');
      peers = peers.filter((p) => !exclude.has(String(p.userId)));
    }

    const peerIds = peers.map((p) => p.userId);
    const count = peerIds.length;

    let snippets = [];
    if (peerIds.length > 0) {
      const since = new Date(Date.now() - POST_LOOKBACK_MS);
      const posts = await Post.find({
        userId: { $in: peerIds },
        hidden: { $ne: true },
        createdAt: { $gte: since },
        text: { $exists: true, $ne: '' },
      })
        .sort({ createdAt: -1 })
        .limit(MAX_SNIPPETS)
        .select('text emoji emotion createdAt');

      snippets = posts.map((p) => ({
        emoji: p.emoji || '😐',
        emotion: p.emotion || 'neutral',
        text: String(p.text || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 160),
        agoMinutes: Math.max(0, Math.round((now - new Date(p.createdAt).getTime()) / 60000)),
      }));
    }

    res.json({
      count,
      matchMode,
      emotion,
      emotionLabel: emotionLabel(emotion, lang),
      bucket,
      expiresInSec: Math.round(PRESENCE_MS / 1000),
      snippets,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  joinMoodNeighbors,
  getMoodNeighbors,
};

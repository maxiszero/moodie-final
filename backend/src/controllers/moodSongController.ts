// @ts-nocheck
const { suggestMoodSongs } = require('../utils/aiAnalyzer');

// @desc   Mood song candidates before publishing (proxies Python service)
// @route  POST /api/mood-song/suggest
// @access Private
const suggestMoodSongsHandler = async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ message: 'Please provide text' });
    }
    if (text.length > 228) {
      return res.status(400).json({ message: 'Post text cannot exceed 228 characters' });
    }
    if (/(https?:\/\/\S+|www\.\S+)/gi.test(text)) {
      return res.status(400).json({ message: 'Links are not allowed in posts for security reasons' });
    }
    const rawLimit = parseInt(req.body?.limit, 10);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 5;
    const out = await suggestMoodSongs(text, limit);
    res.json(out);
  } catch (err) {
    next(err);
  }
};

module.exports = { suggestMoodSongsHandler };

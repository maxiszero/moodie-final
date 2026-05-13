// @ts-nocheck
/**
 * Server-side canonical emotion colors.
 * We enforce this mapping when creating posts so UI stays consistent
 * even if an AI model returns odd palettes.
 */

const EMOTION_PALETTE = {
  happy: { color: '#FFD166', color2: '#FFB703', color3: '#FB8500' },
  sad: { color: '#BFDBFE', color2: '#60A5FA', color3: '#2563EB' },
  anxious: { color: '#FEF3C7', color2: '#F59E0B', color3: '#EA580C' },
  calmness: { color: '#CCFBF1', color2: '#2DD4BF', color3: '#059669' },
  angry: { color: '#FECACA', color2: '#EF4444', color3: '#B91C1C' },
  scared: { color: '#DDD6FE', color2: '#8B5CF6', color3: '#4C1D95' },
  loved: { color: '#FBCFE8', color2: '#EC4899', color3: '#BE185D' },

  // Extra moods used in app
  neutral: { color: '#9E9E9E', color2: '#757575', color3: '#616161' },
  tired: { color: '#E7E5E4', color2: '#A8A29E', color3: '#57534E' },
  apathy: { color: '#E2E8F0', color2: '#94A3B8', color3: '#475569' },
  melancholy: { color: '#C7D2FE', color2: '#818CF8', color3: '#4338CA' },
  inspiration: { color: '#E9D5FF', color2: '#A855F7', color3: '#7E22CE' },
  drive: { color: '#FED7AA', color2: '#FB923C', color3: '#C2410C' },
  excited: { color: '#FEF08A', color2: '#FACC15', color3: '#CA8A04' },
};

const EMOTION_ALIASES = {
  calm: 'calmness',
  love: 'loved',
  inspired: 'inspiration',
  driven: 'drive',
  hyped: 'excited',
  funny: 'happy',
};

function normalizeEmotion(e) {
  const raw = typeof e === 'string' ? e.trim().toLowerCase() : 'neutral';
  return EMOTION_ALIASES[raw] || raw || 'neutral';
}

function paletteForEmotion(e) {
  const key = normalizeEmotion(e);
  return EMOTION_PALETTE[key] ? { emotion: key, ...EMOTION_PALETTE[key] } : null;
}

module.exports = { paletteForEmotion, normalizeEmotion };


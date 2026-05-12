// @ts-nocheck
/**
 * Server-side canonical emotion colors.
 * We enforce this mapping when creating posts so UI stays consistent
 * even if an AI model returns odd palettes.
 */

const EMOTION_PALETTE = {
  happy: { color: '#FF9500', color2: '#FFB703', color3: '#FFCC33' },
  sad: { color: '#2c3e50', color2: '#34495e', color3: '#4ca1af' },
  anxious: { color: '#FFD200', color2: '#F5A623', color3: '#F7971E' },
  calmness: { color: '#00b09b', color2: '#56ab2f', color3: '#96c93d' },
  angry: { color: '#C62828', color2: '#E53935', color3: '#FF5252' },
  scared: { color: '#311B92', color2: '#5E35B1', color3: '#7E57C2' },
  loved: { color: '#EC407A', color2: '#E91E63', color3: '#AB47BC' },

  // Extra moods used in app
  neutral: { color: '#9E9E9E', color2: '#757575', color3: '#616161' },
  tired: { color: '#78716C', color2: '#A8A29E', color3: '#D6D3D1' },
  apathy: { color: '#94A3B8', color2: '#CBD5E1', color3: '#64748B' },
  melancholy: { color: '#2c3e50', color2: '#4ca1af', color3: '#6366F1' },
  inspiration: { color: '#A855F7', color2: '#D8B4FE', color3: '#C084FC' },
  drive: { color: '#EA580C', color2: '#FB923C', color3: '#FDBA74' },
  excited: { color: '#FFB703', color2: '#FFCC33', color3: '#FFD200' },
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


// @ts-nocheck
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  text: {
    type: String,
    required: [true, 'Please add text content']
  },
  emotion: {
    type: String,
    default: 'neutral',
    index: true
  },
  emoji: {
    type: String,
    default: '😐'
  },
  intensity: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  color: {
    type: String,
    default: '#E0E7FF'
  },
  color2: {
    type: String,
    default: '#A5B4FC'
  },
  color3: {
    type: String,
    default: '#6366F1'
  },
  reasoning: {
    type: String,
    default: ''
  },
  tip: {
    type: String,
    default: ''
  },
  // New reactions system
  reactions: [{
    type: {
      type: String,
      enum: ['feel_this', 'stay_strong', 'hits_hard'],
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  relatable: {
    type: Number,
    default: 0
  },
  relatableBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reports: {
    type: Number,
    default: 0
  },
  reportedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  hidden: {
    type: Boolean,
    default: false,
    index: true
  },
  /** AI moderation: 0–100, higher = better fit for top of feed. Not exposed in API (select: false). */
  feedQuality: {
    type: Number,
    default: 65,
    min: 0,
    max: 100,
    select: false,
  },
  /** Sort key: recency minus penalty for low feedQuality (hidden from API). */
  feedSortScore: {
    type: Number,
    default: 0,
    select: false,
  },
  commentsCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  moodSongTitle: { type: String, default: '' },
  moodSongArtist: { type: String, default: '' },
  moodSongPreviewUrl: { type: String, default: '' },
  moodSongExternalUrl: { type: String, default: '' },
  moodSongArtworkUrl: { type: String, default: '' },
  moodSongSource: { type: String, default: '' },
}, {
  timestamps: true // Automatically creates createdAt and updatedAt fields
});

const FEED_QUALITY_PENALTY_MS = 3 * 60 * 1000; // 3 minutes of “virtual age” per point below 100

function recomputeFeedSortScore(doc) {
  const q = doc.feedQuality != null ? Math.min(100, Math.max(0, doc.feedQuality)) : 65;
  doc.feedQuality = q;
  const t = doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now();
  doc.feedSortScore = t - (100 - q) * FEED_QUALITY_PENALTY_MS;
}

postSchema.pre('save', function (next) {
  try {
    recomputeFeedSortScore(this);
  } catch (e) {
    return next(e);
  }
  next();
});

postSchema.index({ createdAt: -1 });
postSchema.index({ likes: -1, createdAt: -1 });
postSchema.index({ feedSortScore: -1 });

module.exports = mongoose.model('Post', postSchema);
// @ts-nocheck
const mongoose = require('mongoose');

const moodNeighborPresenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    emotion: {
      type: String,
      default: 'neutral',
      maxlength: 32,
      trim: true,
    },
    bucket: {
      type: String,
      enum: ['light', 'heavy', 'neutral'],
      default: 'neutral',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

moodNeighborPresenceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MoodNeighborPresence', moodNeighborPresenceSchema);

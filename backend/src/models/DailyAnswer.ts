// @ts-nocheck
const mongoose = require('mongoose');

const dailyAnswerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dayKey: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    moodBucket: {
      type: String,
      enum: ['light', 'heavy', 'neutral'],
      required: true,
    },
    questionText: {
      type: String,
      required: true,
      maxlength: 500,
    },
    lang: {
      type: String,
      enum: ['ru', 'en'],
      default: 'ru',
    },
    text: {
      type: String,
      required: true,
      maxlength: 600,
      trim: true,
    },
  },
  { timestamps: true },
);

dailyAnswerSchema.index({ userId: 1, dayKey: 1 }, { unique: true });
dailyAnswerSchema.index({ dayKey: -1, createdAt: -1 });

module.exports = mongoose.model('DailyAnswer', dailyAnswerSchema);

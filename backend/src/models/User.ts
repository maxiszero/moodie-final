// @ts-nocheck
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please add a username'],
    unique: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
  },
  currentEmotion: {
    type: String,
    default: 'neutral'
  },
  currentEmoji: {
    type: String,
    default: '😐'
  },
  currentColor: {
    type: String,
    default: '#E0E7FF'
  },
  currentColor2: {
    type: String,
    default: '#A5B4FC'
  },
  currentColor3: {
    type: String,
    default: '#6366F1'
  },
  weeklyAiSummary: {
    type: String,
    default: '',
    maxlength: 600,
  },
  weeklyAiSummaryAt: {
    type: Date,
    default: null,
  },
  moodSongTitle: {
    type: String,
    default: '',
    maxlength: 120,
    trim: true,
  },
  moodSongArtist: {
    type: String,
    default: '',
    maxlength: 120,
    trim: true,
  },
  moodSongPreviewUrl: {
    type: String,
    default: '',
    maxlength: 500,
    trim: true,
  },
  moodSongExternalUrl: {
    type: String,
    default: '',
    maxlength: 500,
    trim: true,
  },
  moodSongArtworkUrl: {
    type: String,
    default: '',
    maxlength: 500,
    trim: true,
  },
  moodSongSource: {
    type: String,
    default: '',
    maxlength: 32,
    trim: true,
  },
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: []
  },
  preferredLanguage: {
    type: String,
    enum: ['ru', 'en'],
    default: 'ru'
  },
  preferredTheme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light'
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  banned: {
    type: Boolean,
    default: false,
    index: true
  },
  registrationIp: {
    type: String,
    default: '',
    maxlength: 45,
    trim: true,
  },
  lastIp: {
    type: String,
    default: '',
    maxlength: 45,
    trim: true,
  },
  telegramUserId: {
    type: Number,
    sparse: true,
    unique: true,
    index: true,
  },
  telegramUsername: {
    type: String,
    default: '',
    maxlength: 64,
    trim: true,
  },
  telegramChatId: {
    type: Number,
    default: null,
    sparse: true,
  },
  telegramDailyNotify: {
    type: Boolean,
    default: false,
  },
  telegramActivityNotify: {
    type: Boolean,
    default: true,
  },
  telegramDailyNotifyHour: {
    type: Number,
    default: 8,
    min: 0,
    max: 23,
  },
  telegramTimezoneOffsetMinutes: {
    type: Number,
    default: 0,
    min: -840,
    max: 840,
  },
  telegramQuietHoursEnabled: {
    type: Boolean,
    default: false,
  },
  telegramQuietStartHour: {
    type: Number,
    default: 23,
    min: 0,
    max: 23,
  },
  telegramQuietEndHour: {
    type: Number,
    default: 9,
    min: 0,
    max: 23,
  },
  lastTelegramActivityNotifyAt: {
    type: Date,
    default: null,
  },
  lastTelegramActivityNotifyType: {
    type: String,
    default: '',
    maxlength: 32,
    trim: true,
  },
  lastDailyNotifyDayKey: {
    type: String,
    default: '',
    maxlength: 16,
    trim: true,
  },
}, {
  timestamps: true
});

userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);

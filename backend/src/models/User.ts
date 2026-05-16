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
    default: '#9E9E9E'
  },
  currentColor2: {
    type: String,
    default: '#757575'
  },
  currentColor3: {
    type: String,
    default: '#616161'
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

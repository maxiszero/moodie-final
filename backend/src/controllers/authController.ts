// @ts-nocheck
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { paletteForEmotion, normalizeEmotion } = require('../config/emotionPalette');
const { getClientIp } = require('../utils/clientIp');

// Helper to generate a JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

function normalizeUsername(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function normalizePassword(v) {
  return typeof v === 'string' ? v : '';
}

function validateUsername(username) {
  // Allow Latin/Cyrillic letters, numbers, underscore and dot.
  // Keep bounds strict to prevent abuse / UI breakage.
  if (!username) return 'Please add all fields';
  if (username.length < 3 || username.length > 24) return 'Username must be 3-24 characters';
  if (!/^[\p{L}\p{N}_.]+$/u.test(username)) return 'Username contains invalid characters';
  return null;
}

function validatePassword(password) {
  if (!password) return 'Please add all fields';
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (password.length > 72) return 'Password is too long';
  return null;
}

// @desc    Register new user
// @route   POST /api/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = normalizePassword(req.body?.password);
    const onboardingMoodRaw = typeof req.body?.onboardingMood === 'string' ? req.body.onboardingMood : '';
    const onboardingEmoji = typeof req.body?.onboardingEmoji === 'string' ? req.body.onboardingEmoji : '';

    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ message: usernameErr });
    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ message: passwordErr });

    // Check if user already exists
    const userExists = await User.findOne({ username });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const userCount = await User.countDocuments();
    const allowFirstAdmin = String(process.env.ALLOW_FIRST_ADMIN || '').toLowerCase() === 'true';
    const isFirstUserAdmin = allowFirstAdmin && userCount === 0;

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in DB
    const emo = normalizeEmotion(onboardingMoodRaw || 'neutral');
    const pal = paletteForEmotion(emo);
    const ip = getClientIp(req);
    const user = await User.create({
      username,
      password: hashedPassword,
      role: isFirstUserAdmin ? 'admin' : 'user',
      currentEmotion: pal?.emotion || emo || 'neutral',
      currentEmoji: onboardingEmoji || (pal?.emotion === 'sad' ? '😢' : '😐'),
      currentColor: pal?.color,
      currentColor2: pal?.color2,
      currentColor3: pal?.color3,
      registrationIp: ip,
      lastIp: ip,
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        username: user.username,
        currentEmotion: user.currentEmotion || pal?.emotion || 'neutral',
        currentEmoji: user.currentEmoji || onboardingEmoji || '😐',
        currentColor: user.currentColor || pal?.color || '#C5CAE9',
        currentColor2: user.currentColor2 || pal?.color2 || '#E4D6F5',
        currentColor3: user.currentColor3 || pal?.color3 || '#C7B8EA',
        preferredLanguage: user.preferredLanguage || 'ru',
        preferredTheme: user.preferredTheme || 'light',
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate a user
// @route   POST /api/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = normalizePassword(req.body?.password);

    const usernameErr = validateUsername(username);
    if (usernameErr) return res.status(400).json({ message: usernameErr });
    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ message: passwordErr });

    // Check for user
    const user = await User.findOne({ username });

    // Validate password using bcrypt
    if (user && user.banned) {
      return res.status(403).json({ message: 'Account banned' });
    }

    if (user && (await bcrypt.compare(password, user.password))) {
      const ip = getClientIp(req);
      user.lastIp = ip;
      await user.save();

      res.json({
        _id: user.id,
        username: user.username,
        currentEmotion: user.currentEmotion,
        currentEmoji: user.currentEmoji,
        currentColor: user.currentColor,
        currentColor2: user.currentColor2,
        currentColor3: user.currentColor3,
        preferredLanguage: user.preferredLanguage || 'ru',
        preferredTheme: user.preferredTheme || 'light',
        role: user.role || 'user',
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Current user profile (incl. currentEmotion)
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      _id: user.id,
      username: user.username,
      currentEmotion: user.currentEmotion || 'neutral',
      currentEmoji: user.currentEmoji || '😐',
      currentColor: user.currentColor || '#9E9E9E',
      currentColor2: user.currentColor2 || '#757575',
      currentColor3: user.currentColor3 || '#616161',
      preferredLanguage: user.preferredLanguage || 'ru',
      preferredTheme: user.preferredTheme || 'light',
      role: user.role || 'user',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
};
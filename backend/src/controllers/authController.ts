// @ts-nocheck
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const { paletteForEmotion, normalizeEmotion } = require('../config/emotionPalette');
const { getClientIp } = require('../utils/clientIp');

// Helper to generate a JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

function authPayload(user, token = null) {
  const payload = {
    _id: user.id || String(user._id),
    username: user.username,
    currentEmotion: user.currentEmotion || 'neutral',
    currentEmoji: user.currentEmoji || '😐',
    currentColor: user.currentColor || '#9E9E9E',
    currentColor2: user.currentColor2 || '#757575',
    currentColor3: user.currentColor3 || '#616161',
    preferredLanguage: user.preferredLanguage || 'ru',
    preferredTheme: user.preferredTheme || 'light',
    role: user.role || 'user',
    telegramLinked: user.telegramUserId != null,
  };
  if (token) payload.token = token;
  return payload;
}

function validateTelegramInitData(initData) {
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!botToken) throw Object.assign(new Error('Telegram linking is not configured'), { statusCode: 503 });
  if (!initData || typeof initData !== 'string') {
    throw Object.assign(new Error('initData is required'), { statusCode: 400 });
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw Object.assign(new Error('Missing hash'), { statusCode: 400 });
  params.delete('hash');

  const authDateRaw = params.get('auth_date');
  if (!authDateRaw) throw Object.assign(new Error('Missing auth_date'), { statusCode: 400 });
  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate)) throw Object.assign(new Error('Invalid auth_date'), { statusCode: 400 });
  if (Date.now() / 1000 - authDate > 86400) {
    throw Object.assign(new Error('initData expired'), { statusCode: 400 });
  }

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (
    receivedHash.length !== calculated.length ||
    !crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(receivedHash))
  ) {
    throw Object.assign(new Error('Invalid initData signature'), { statusCode: 400 });
  }

  const userRaw = params.get('user');
  if (!userRaw) throw Object.assign(new Error('Missing user in initData'), { statusCode: 400 });
  let tgUser;
  try {
    tgUser = JSON.parse(userRaw);
  } catch {
    throw Object.assign(new Error('Invalid user JSON'), { statusCode: 400 });
  }
  const telegramUserId = Number(tgUser?.id);
  if (!Number.isSafeInteger(telegramUserId)) {
    throw Object.assign(new Error('Invalid user id'), { statusCode: 400 });
  }

  return {
    telegramUserId,
    telegramUsername: typeof tgUser.username === 'string' ? tgUser.username : '',
  };
}

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
      res.status(201).json(authPayload(user, generateToken(user._id)));
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

      res.json(authPayload(user, generateToken(user._id)));
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
    res.json(authPayload(user));
  } catch (error) {
    next(error);
  }
};

const telegramWebAppLogin = async (req, res, next) => {
  try {
    const { telegramUserId } = validateTelegramInitData(req.body?.initData);
    const user = await User.findOne({ telegramUserId });
    if (!user) {
      return res.status(404).json({
        message:
          'Telegram is not linked to a Moodie account. Register with username and password, then link Telegram in Settings.',
      });
    }
    if (user.banned) {
      return res.status(403).json({ message: 'Account banned' });
    }

    user.lastIp = getClientIp(req);
    await user.save();
    res.json(authPayload(user, generateToken(user._id)));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
};

const linkTelegram = async (req, res, next) => {
  try {
    const { telegramUserId, telegramUsername } = validateTelegramInitData(req.body?.initData);

    const existingOwner = await User.findOne({ telegramUserId }).select('_id');
    if (existingOwner && String(existingOwner._id) !== String(req.user._id)) {
      return res.status(409).json({ message: 'This Telegram account is already linked to another user' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.telegramUserId != null && Number(user.telegramUserId) !== telegramUserId) {
      return res.status(409).json({
        message: 'This Moodie account is already linked to another Telegram account. Unlink first.',
      });
    }

    user.telegramUserId = telegramUserId;
    user.telegramUsername = telegramUsername || '';
    user.telegramChatId = telegramUserId;
    await user.save();
    res.json(authPayload(user));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'This Telegram account is already linked to another user' });
    }
    next(error);
  }
};

const unlinkTelegram = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.telegramUserId = undefined;
    user.telegramUsername = '';
    user.telegramChatId = null;
    user.telegramDailyNotify = false;
    user.telegramActivityNotify = false;
    user.lastTelegramActivityNotifyAt = null;
    user.lastTelegramActivityNotifyType = '';
    user.lastDailyNotifyDayKey = '';
    await user.save();
    res.json(authPayload(user));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  telegramWebAppLogin,
  linkTelegram,
  unlinkTelegram,
};
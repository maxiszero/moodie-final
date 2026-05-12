// @ts-nocheck
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Small helper to create a rate limiter with sane defaults.
 * Uses in-memory store (OK for single-instance / dev).
 */
function makeLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: message || { message: 'Too many requests' },
    keyGenerator: (req) => ipKeyGenerator(req.ip),
  });
}

// Bruteforce-ish endpoints
const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { message: 'Too many auth attempts. Try again later.' },
});

// Expensive endpoint (AI)
const aiTipLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 12,
  message: { message: 'Too many AI tip requests. Slow down.' },
});

// Posting spam
const createPostLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: { message: 'Too many posts. Slow down.' },
});

// Interaction spam (likes/reactions/reports/comments)
const interactionLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { message: 'Too many actions. Slow down.' },
});

const commentLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: 'Too many comments. Slow down.' },
});

module.exports = { authLimiter, aiTipLimiter, createPostLimiter, interactionLimiter, commentLimiter };


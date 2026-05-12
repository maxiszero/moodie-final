// @ts-nocheck
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/** Sets req.user if valid Bearer token; otherwise req.user = null */
const optionalAuth = async (req, res, next) => {
  req.user = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer')) {
    try {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (req.user && req.user.banned) {
        req.user = null;
      }
    } catch (e) {
      /* ignore invalid token for public routes */
    }
  }
  next();
};

module.exports = { optionalAuth };

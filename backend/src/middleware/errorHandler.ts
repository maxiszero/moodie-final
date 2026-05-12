// @ts-nocheck
const crypto = require('node:crypto');

function requestId(req, res, next) {
  const id =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

function notFound(req, res, next) {
  res.status(404).json({ message: 'Endpoint not found', requestId: req.requestId });
}

// Central error handler: avoid leaking internal messages in production.
function errorHandler(err, req, res, next) {
  const status = Number(err && err.status) || 500;
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  const requestId = req.requestId;
  const safeMessage = status >= 500 ? 'Server error' : (err && err.message) || 'Error';

  // Always log server-side with requestId for correlation.
  // eslint-disable-next-line no-console
  console.error(`[${requestId}]`, err);

  res.status(status).json({
    message: isProd && status >= 500 ? 'Server error' : safeMessage,
    requestId,
  });
}

module.exports = { requestId, notFound, errorHandler };


// @ts-nocheck
/**
 * Best-effort client IP (IPv4/IPv6). Use with app.set('trust proxy', 1) behind a reverse proxy.
 */
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim().slice(0, 45);
  }
  if (Array.isArray(xff) && xff[0]) {
    return String(xff[0]).trim().slice(0, 45);
  }
  const raw = req.ip || req.socket?.remoteAddress || '';
  if (typeof raw === 'string' && raw.startsWith('::ffff:')) {
    return raw.slice(7).slice(0, 45);
  }
  return typeof raw === 'string' ? raw.slice(0, 45) : '';
}

module.exports = { getClientIp };

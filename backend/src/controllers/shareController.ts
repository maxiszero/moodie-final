// @ts-nocheck
const User = require('../models/User');
const Post = require('../models/Post');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function appBaseUrl(req) {
  const fromEnv = (process.env.TELEGRAM_WEB_APP_URL || process.env.SITE_URL || process.env.PUBLIC_SITE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  return host ? `${proto}://${host}` : '';
}

function logoUrl(base) {
  return `${base}/logo.png`;
}

function ogPage({ title, description, url, image }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:url" content="${escapeHtml(url)}"/>
<meta property="og:image" content="${escapeHtml(image)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(description)}"/>
<meta name="twitter:image" content="${escapeHtml(image)}"/>
<meta http-equiv="refresh" content="0;url=${escapeHtml(url)}"/>
</head>
<body><p><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></p></body>
</html>`;
}

const shareProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username, banned: { $ne: true } }).select(
      'username currentEmoji currentEmotion',
    );
    if (!user) return res.status(404).send('Not found');

    const base = appBaseUrl(req);
    const hashUrl = `${base}/#/profile/${encodeURIComponent(user.username)}`;
    const title = `@${user.username} — Moodie`;
    const emoji = user.currentEmoji || '😐';
    const emotion = user.currentEmotion || 'neutral';
    const description = `${emoji} ${emotion} — mood profile on Moodie`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      ogPage({
        title,
        description,
        url: hashUrl,
        image: logoUrl(base),
      }),
    );
  } catch (error) {
    next(error);
  }
};

const sharePost = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.postId, hidden: { $ne: true } }).populate(
      'userId',
      'username banned',
    );
    if (!post || !post.userId || post.userId.banned) return res.status(404).send('Not found');

    const author = post.userId.username || 'Moodie';
    const base = appBaseUrl(req);
    const hashUrl = `${base}/#/profile/${encodeURIComponent(author)}?post=${encodeURIComponent(String(post._id))}`;
    const snippet = String(post.text || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const emoji = post.emoji || '😐';
    const title = `${emoji} @${author} on Moodie`;
    const description = snippet || 'Mood post on Moodie';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      ogPage({
        title,
        description,
        url: hashUrl,
        image: logoUrl(base),
      }),
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  shareProfile,
  sharePost,
};

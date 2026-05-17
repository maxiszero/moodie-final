// @ts-nocheck
const User = require('../models/User');

const MAX_TEXT = 600;
const ACTIVITY_MIN_GAP_MS = Math.max(0, Number(process.env.TELEGRAM_ACTIVITY_NOTIFY_MIN_GAP_SEC ?? 600) || 0) * 1000;

function localHourFor(user, value = new Date()) {
  const offset = Number.isFinite(Number(user?.telegramTimezoneOffsetMinutes))
    ? Number(user.telegramTimezoneOffsetMinutes)
    : 0;
  return new Date(value.getTime() - offset * 60 * 1000).getUTCHours();
}

function isQuietNow(user, value = new Date()) {
  if (!user?.telegramQuietHoursEnabled) return false;
  const start = Math.max(0, Math.min(23, Number(user.telegramQuietStartHour ?? 23)));
  const end = Math.max(0, Math.min(23, Number(user.telegramQuietEndHour ?? 9)));
  if (start === end) return false;
  const hour = localHourFor(user, value);
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function webAppMarkup() {
  const url = String(process.env.TELEGRAM_WEB_APP_URL || '').trim();
  if (!url.startsWith('https://')) return null;
  return {
    inline_keyboard: [
      [
        {
          text: `Open ${String(process.env.TELEGRAM_BOT_SHORT_NAME || 'Moodie').trim() || 'Moodie'}`,
          web_app: { url },
        },
      ],
    ],
  };
}

async function sendTelegramMessage(chatId, text) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token || !chatId || !text) return;

  const payload = {
    chat_id: chatId,
    text: String(text).slice(0, MAX_TEXT),
  };
  const replyMarkup = webAppMarkup();
  if (replyMarkup) payload.reply_markup = replyMarkup;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram sendMessage ${res.status}: ${body.slice(0, 200)}`);
  }
}

function wantsTelegramActivity(user) {
  return Boolean(
    (user?.telegramActivityNotify !== false) &&
      (user?.telegramActivityNotify || user?.telegramDailyNotify) &&
      (user.telegramChatId || user.telegramUserId) &&
      !isQuietNow(user),
  );
}

function chatIdFor(user) {
  return user?.telegramChatId || user?.telegramUserId || null;
}

async function claimActivitySlot(user, type) {
  if (!user?._id) return false;
  const cutoff = new Date(Date.now() - ACTIVITY_MIN_GAP_MS);
  const result = await User.updateOne(
    {
      _id: user._id,
      $or: [
        { lastTelegramActivityNotifyAt: { $exists: false } },
        { lastTelegramActivityNotifyAt: null },
        { lastTelegramActivityNotifyAt: { $lte: cutoff } },
      ],
    },
    {
      $set: {
        lastTelegramActivityNotifyAt: new Date(),
        lastTelegramActivityNotifyType: type || 'activity',
      },
    },
  );
  return result.modifiedCount > 0;
}

function notifyTelegramUser(user, text, type = 'activity') {
  if (!wantsTelegramActivity(user)) return;
  void (async () => {
    if (!(await claimActivitySlot(user, type))) return;
    await sendTelegramMessage(chatIdFor(user), text);
  })().catch((err) => {
    console.error('Telegram activity notify failed:', err.message);
  });
}

function notifyTelegramUsers(users, textForUser, type = 'activity') {
  for (const user of users || []) {
    const text = typeof textForUser === 'function' ? textForUser(user) : textForUser;
    notifyTelegramUser(user, text, type);
  }
}

module.exports = {
  notifyTelegramUser,
  notifyTelegramUsers,
};

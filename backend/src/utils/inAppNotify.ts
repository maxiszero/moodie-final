// @ts-nocheck

function userRoom(userId) {
  return `user:${String(userId)}`;
}

function notifyInAppUser(io, userId, message, type = 'activity', extra = {}) {
  if (!io || !userId || !message) return;
  io.to(userRoom(userId)).emit('app_notification', {
    type,
    message: String(message).slice(0, 600),
    createdAt: new Date().toISOString(),
    ...extra,
  });
}

function notifyInAppUsers(io, users, messageForUser, type = 'activity') {
  for (const user of users || []) {
    const message = typeof messageForUser === 'function' ? messageForUser(user) : messageForUser;
    notifyInAppUser(io, user?._id, message, type);
  }
}

module.exports = {
  notifyInAppUser,
  notifyInAppUsers,
  userRoom,
};

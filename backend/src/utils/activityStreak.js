// @ts-nocheck
/** Consecutive activity days (post or daily answer), with grace if today is empty. */

function localDayKey(date, offsetMinutes = 0) {
  const d = new Date(date.getTime() - offsetMinutes * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function computeActivityStreak(postDayKeys, answerDayKeys, offsetMinutes = 0) {
  const days = new Set([...(postDayKeys || []), ...(answerDayKeys || [])]);
  if (!days.size) return 0;

  const today = localDayKey(new Date(), offsetMinutes);
  let cursor = today;
  if (!days.has(cursor)) {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    cursor = localDayKey(yesterday, offsetMinutes);
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    const d = new Date(`${cursor}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return streak;
}

module.exports = {
  localDayKey,
  computeActivityStreak,
};

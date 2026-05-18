// @ts-nocheck
/** CSV export/import for user settings (mirrors backend-py/app/services/settings_csv.py). */

const CSV_HEADERS = [
  'preferredLanguage',
  'preferredTheme',
  'telegramDailyNotify',
  'telegramActivityNotify',
  'telegramDailyNotifyHour',
  'telegramQuietHoursEnabled',
  'telegramQuietStartHour',
  'telegramQuietEndHour',
];

function boolToCell(v) {
  return v ? 'true' : 'false';
}

function userDocToRow(user) {
  const hour = Number(user.telegramDailyNotifyHour);
  const qs = Number(user.telegramQuietStartHour);
  const qe = Number(user.telegramQuietEndHour);
  const hourN = Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : 9;
  const qStart = Number.isFinite(qs) ? Math.max(0, Math.min(23, qs)) : 22;
  const qEnd = Number.isFinite(qe) ? Math.max(0, Math.min(23, qe)) : 8;

  return {
    preferredLanguage: String(user.preferredLanguage || 'ru'),
    preferredTheme: String(user.preferredTheme || 'light'),
    telegramDailyNotify: boolToCell(Boolean(user.telegramDailyNotify)),
    telegramActivityNotify: boolToCell(user.telegramActivityNotify !== false),
    telegramDailyNotifyHour: String(hourN),
    telegramQuietHoursEnabled: boolToCell(Boolean(user.telegramQuietHoursEnabled)),
    telegramQuietStartHour: String(qStart),
    telegramQuietEndHour: String(qEnd),
  };
}

function escapeCsvCell(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsvBytes(row) {
  const header = CSV_HEADERS.join(',');
  const line = CSV_HEADERS.map((k) => escapeCsvCell(row[k] ?? '')).join(',');
  return Buffer.from(`${header}\n${line}\n`, 'utf8');
}

function parseBoolCell(raw) {
  const x = String(raw).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(x)) return true;
  if (['false', '0', 'no', 'off'].includes(x)) return false;
  throw new Error(`Invalid boolean value in CSV: ${raw} (use true/false)`);
}

function parseHourCell(raw) {
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 0 || n > 23) throw new Error(`Hour must be 0–23, got ${raw}`);
  return n;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsvToUpdates(text) {
  const normalized = String(text || '').replace(/^\uFEFF/, '').trim();
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('CSV has no data rows');

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const headerSet = new Set(headers.filter(Boolean));
  const unknown = [...headerSet].filter((h) => !CSV_HEADERS.includes(h));
  if (unknown.length) throw new Error(`Unknown columns: ${unknown.sort().join(', ')}`);

  const values = parseCsvLine(lines[1]);
  const raw = {};
  headers.forEach((h, i) => {
    raw[h] = values[i] ?? '';
  });

  const updates = {};
  const getCell = (key) => {
    if (!(key in raw)) return null;
    const s = String(raw[key] ?? '').trim();
    return s || null;
  };

  const lang = getCell('preferredLanguage');
  if (lang !== null) {
    const l = lang.toLowerCase();
    if (!['ru', 'en'].includes(l)) throw new Error('preferredLanguage must be ru or en');
    updates.preferredLanguage = l;
  }

  const theme = getCell('preferredTheme');
  if (theme !== null) {
    const th = theme.toLowerCase();
    if (!['light', 'dark'].includes(th)) throw new Error('preferredTheme must be light or dark');
    updates.preferredTheme = th;
  }

  let cell = getCell('telegramDailyNotify');
  if (cell !== null) updates.telegramDailyNotify = parseBoolCell(cell);

  cell = getCell('telegramActivityNotify');
  if (cell !== null) updates.telegramActivityNotify = parseBoolCell(cell);

  cell = getCell('telegramDailyNotifyHour');
  if (cell !== null) updates.telegramDailyNotifyHour = parseHourCell(cell);

  cell = getCell('telegramQuietHoursEnabled');
  if (cell !== null) updates.telegramQuietHoursEnabled = parseBoolCell(cell);

  cell = getCell('telegramQuietStartHour');
  if (cell !== null) updates.telegramQuietStartHour = parseHourCell(cell);

  cell = getCell('telegramQuietEndHour');
  if (cell !== null) updates.telegramQuietEndHour = parseHourCell(cell);

  if (!Object.keys(updates).length) {
    throw new Error('No settings to import (fill at least one column)');
  }

  return updates;
}

module.exports = {
  CSV_HEADERS,
  userDocToRow,
  rowToCsvBytes,
  parseCsvToUpdates,
};

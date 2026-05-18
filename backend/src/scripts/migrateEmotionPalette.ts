/**
 * One-shot migration: replace legacy gray / stone mood colors on Users and Posts
 * with the canonical palette for each document's `emotion` / `currentEmotion`.
 *
 * Run from backend folder (requires MONGODB_URI in .env):
 *   npx tsx src/scripts/migrateEmotionPalette.ts
 *
 * Safe to run multiple times: only updates rows that still match known legacy triples.
 */
import path from 'node:path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const User = require('../models/User');
const Post = require('../models/Post');
const { paletteForEmotion } = require('../config/emotionPalette');

function normHex(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim().toLowerCase();
  if (!s.startsWith('#')) return s;
  if (s.length === 4) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return s;
}

function tripleKey(a: unknown, b: unknown, c: unknown): string {
  const strip = (v: string) => (v.startsWith('#') ? v.slice(1) : v);
  return `${strip(normHex(a))}|${strip(normHex(b))}|${strip(normHex(c))}`;
}

/** Known RGB triples emitted by older Moodie versions (lowercase keys). */
const LEGACY_TRIPLES = new Set<string>([
  '9e9e9e|757575|616161',
  'e7e5e4|d6d3d1|a8a29e',
  'e7e5e4|a8a29e|57534e',
  'ddd6fe|a78bfa|7c3aed',
  'cbd5e1|94a3b8|64748b',
  'e2e8f0|94a3b8|475569',
]);

const LEGACY_SINGLE = new Set([
  '9e9e9e',
  '757575',
  '616161',
  'e7e5e4',
  'd6d3d1',
  'a8a29e',
  '57534e',
  'e2e8f0',
  '94a3b8',
  '475569',
  'cbd5e1',
  '64748b',
]);

function needsPaletteMigration(c1: unknown, c2: unknown, c3: unknown): boolean {
  if (LEGACY_TRIPLES.has(tripleKey(c1, c2, c3))) return true;
  const a = normHex(c1).replace(/^#/, '');
  const b = normHex(c2).replace(/^#/, '');
  const c = normHex(c3).replace(/^#/, '');
  if (a && a === b && b === c && LEGACY_SINGLE.has(a)) return true;
  return false;
}

function canonicalForEmotion(emotion: unknown) {
  const pal = paletteForEmotion(typeof emotion === 'string' ? emotion : 'neutral');
  if (pal) {
    return { color: pal.color, color2: pal.color2, color3: pal.color3 };
  }
  return { color: '#E0E7FF', color2: '#A5B4FC', color3: '#6366F1' };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('Connected. Scanning…');

  let usersUpdated = 0;
  const userCursor = User.find({}).cursor();
  for await (const user of userCursor) {
    const c1 = user.currentColor;
    const c2 = user.currentColor2;
    const c3 = user.currentColor3;
    if (!needsPaletteMigration(c1, c2, c3)) continue;
    const next = canonicalForEmotion(user.currentEmotion);
    await User.updateOne(
      { _id: user._id },
      { $set: { currentColor: next.color, currentColor2: next.color2, currentColor3: next.color3 } },
    );
    usersUpdated += 1;
  }

  let postsUpdated = 0;
  const postCursor = Post.find({}).cursor();
  for await (const post of postCursor) {
    const c1 = post.color;
    const c2 = post.color2;
    const c3 = post.color3;
    if (!needsPaletteMigration(c1, c2, c3)) continue;
    const next = canonicalForEmotion(post.emotion);
    await Post.updateOne(
      { _id: post._id },
      { $set: { color: next.color, color2: next.color2, color3: next.color3 } },
    );
    postsUpdated += 1;
  }

  console.log(`Done. Users updated: ${usersUpdated}, posts updated: ${postsUpdated}.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

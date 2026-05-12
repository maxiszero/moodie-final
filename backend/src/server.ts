import 'dotenv/config';
import http from 'node:http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { createApp, corsOptions } from './app';
import type { AppContext } from './app';

const connectDB = require('./config/db') as () => Promise<void>;
const User = require('./models/User');
const { utcDayKey } = require('./utils/dailyQuestionPicker') as { utcDayKey: () => string };

if (!process.env.JWT_SECRET || !String(process.env.JWT_SECRET).trim()) {
  throw new Error('Missing required env: JWT_SECRET');
}

void connectDB();

let bannedUserIds: string[] = [];
let appContext: AppContext;

const refreshBannedUsers = async () => {
  try {
    const bannedUsers = await User.find({ banned: true }).distinct('_id');
    bannedUserIds = bannedUsers.map((id: unknown) => String(id));
    appContext.bannedUserIds = bannedUserIds;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Failed to refresh banned users cache:', message);
  }
};

appContext = {
  bannedUserIds,
  refreshBannedUsers,
};

const app = createApp(appContext);

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});
appContext.io = io;

mongoose.connection.once('open', async () => {
  const name = process.env.ADMIN_USERNAME;
  const enableBootstrap = String(process.env.ENABLE_ADMIN_BOOTSTRAP || '').toLowerCase() === 'true';
  if (enableBootstrap && name && name.trim()) {
    try {
      const anyAdmin = await User.exists({ role: 'admin', banned: { $ne: true } });
      if (!anyAdmin) {
        await User.findOneAndUpdate({ username: name.trim() }, { $set: { role: 'admin' } });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('ADMIN_USERNAME bootstrap:', message);
    }
  }

  await refreshBannedUsers();
});

let onlineCount = 0;
io.on('connection', (socket) => {
  onlineCount += 1;
  io.emit('online_count', onlineCount);

  socket.on('disconnect', () => {
    onlineCount = Math.max(0, onlineCount - 1);
    io.emit('online_count', onlineCount);
  });
});

let lastDailySocketDay = utcDayKey();
setInterval(() => {
  const dk = utcDayKey();
  if (dk !== lastDailySocketDay) {
    lastDailySocketDay = dk;
    io.emit('daily_question_day', { dayKey: dk });
  }
}, 45_000);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

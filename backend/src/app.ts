import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Server as SocketIOServer } from 'socket.io';

const { requestId, notFound, errorHandler } = require('./middleware/errorHandler');

export type AppContext = {
  io?: SocketIOServer;
  bannedUserIds?: string[];
  refreshBannedUsers?: () => Promise<void> | void;
};

export const corsOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

export const corsOptions = corsOrigins.length
  ? {
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }
  : isProd
    ? {
        origin: false,
      }
    : {
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
      };

export function createApp(context: AppContext = {}) {
  const app = express();
  app.set('trust proxy', 1);

  app.use((req, _res, next) => {
    req.io = context.io;
    req.bannedUserIds = context.bannedUserIds || [];
    req.refreshBannedUsers = context.refreshBannedUsers;
    next();
  });

  app.use(requestId);
  app.use(cors(corsOptions));
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'none'"],
          imgSrc: ["'self'", "data:", "https://*.mzstatic.com"],
          mediaSrc: ["'self'", "https://*.itunes.apple.com", "https://audio-ssl.itunes.apple.com"],
        },
      },
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/posts', require('./routes/posts'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/daily-question', require('./routes/dailyQuestion'));

  app.get('/', (_req, res) => {
    res.send('Moodie API is running...');
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

import type { Server as SocketIOServer } from 'socket.io';

declare global {
  namespace Express {
    interface Request {
      io?: SocketIOServer;
      requestId?: string;
      user?: any;
      bannedUserIds?: string[];
      refreshBannedUsers?: () => Promise<void> | void;
    }
  }
}

export {};

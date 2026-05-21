import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { AuthTokenPayload } from '../types';
import { PresenceService } from './presenceService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let io: SocketServer;
let presenceService: PresenceService;
const connectedUsers = new Map<string, Set<string>>();

export const HEARTBEAT_INTERVAL_MS = 30_000;

// Extracted so unit tests can exercise it directly without a live server
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // jwt.verify validates the exp claim by default; catch TokenExpiredError
    // separately so the client receives a structured 4001 code
    const decoded = jwt.verify(token, config.jwt.secret) as AuthTokenPayload;
    socket.data.user = decoded;

    logger.info('WebSocket client authenticated', {
      socketId: socket.id,
      userId: decoded.userId,
      email: decoded.email,
    });

    next();
  } catch (error) {
    logger.error('WebSocket authentication failed:', error);

    if (error instanceof jwt.TokenExpiredError) {
      const err = new Error('Token expired');
      (err as any).data = { code: 4001 };
      return next(err);
    }

    next(new Error('Authentication failed'));
  }
}

export function initializeWebSocket(server: HttpServer): void {
  io = new SocketServer(server, {
    cors: {
      origin: config.server.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware — delegates to authenticateSocket for testability
  io.use(authenticateSocket);

  // Heartbeat: terminate sockets that stopped responding to server:ping
  const heartbeatTimer = setInterval(() => {
    io.sockets.sockets.forEach((socket) => {
      if (!socket.data.isAlive) {
        socket.disconnect(true);
        return;
      }
      socket.data.isAlive = false;
      socket.emit('server:ping');
    });
  }, HEARTBEAT_INTERVAL_MS);

  io.on('close', () => clearInterval(heartbeatTimer));

  // Initialize presence service
  presenceService = new PresenceService(io);

  io.on('connection', async (socket) => {
    socket.data.isAlive = true;
    socket.on('client:pong', () => { socket.data.isAlive = true; });

    const user = socket.data.user as AuthTokenPayload;

    // Fetch full user details from database
    const userRecord = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, fullName: true, email: true, role: true }
    });

    if (!userRecord) {
      logger.error('User not found in database', { userId: user.userId });
      socket.disconnect();
      return;
    }

    logger.info('WebSocket client connected', {
      socketId: socket.id,
      userId: user.userId,
      userName: userRecord.fullName
    });

    // Track connected users
    if (!connectedUsers.has(user.userId)) {
      connectedUsers.set(user.userId, new Set());
    }
    connectedUsers.get(user.userId)!.add(socket.id);

    // Register user with presence service
    presenceService.userConnected(socket, user.userId, userRecord.fullName, userRecord.role);

    // Handle client subscribing to specific job updates
    socket.on('subscribe-job', (jobId: string) => {
      logger.debug('Client subscribed to job updates', {
        socketId: socket.id,
        userId: user.userId,
        jobId
      });
      socket.join(`job:${jobId}`);
      presenceService.joinJob(user.userId, jobId);
    });

    // Handle client unsubscribing from job updates
    socket.on('unsubscribe-job', (jobId: string) => {
      logger.debug('Client unsubscribed from job updates', {
        socketId: socket.id,
        userId: user.userId,
        jobId
      });
      socket.leave(`job:${jobId}`);
      presenceService.leaveJob(user.userId, jobId);
    });

    // Handle user typing in comment field
    socket.on('typing', (data: { jobId: string }) => {
      presenceService.userTyping(user.userId, userRecord.fullName, data.jobId);
    });

    // Handle user activity (reset idle timer)
    socket.on('activity', () => {
      presenceService.updateActivity(user.userId);
    });

    // Handle queue stats subscription
    socket.on('subscribe-queue-stats', () => {
      socket.join('queue-stats');
      logger.debug('User subscribed to queue stats', {
        socketId: socket.id,
        userId: user.userId
      });
    });

    // Handle ping for connection health
    socket.on('ping', () => {
      socket.emit('pong');
      presenceService.updateActivity(user.userId);
    });

    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        userId: user.userId,
        reason
      });

      // Update connected users tracking
      const userSockets = connectedUsers.get(user.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(user.userId);
          // Notify presence service
          presenceService.userDisconnected(socket);
        }
      }
    });

    // Send initial connection success message
    socket.emit('connected', {
      message: 'Successfully connected to Karmayogi WebSocket',
      userId: user.userId,
      userName: userRecord.fullName,
      timestamp: new Date().toISOString()
    });
  });

  logger.info('WebSocket server initialized');
}

// Job update notifications
export function notifyJobUpdate(jobId: string, userId: string, update: any): void {
  if (!io) return;

  const notification = {
    jobId,
    userId,
    timestamp: new Date().toISOString(),
    ...update
  };

  // Notify specific job subscribers
  io.to(`job:${jobId}`).emit('job-update', notification);
  
  // Notify user
  io.to(`user:${userId}`).emit('job-update', notification);

  // Notify admins
  io.to('admin').emit('admin-job-update', notification);

  logger.debug('Job update notification sent', {
    jobId,
    userId,
    update: update.status || 'progress'
  });
}

// Progress update notifications
export function notifyJobProgress(jobId: string, userId: string, progress: number, message?: string): void {
  if (!io) return;

  const notification = {
    type: 'progress',
    jobId,
    userId,
    progress,
    message,
    timestamp: new Date().toISOString()
  };

  io.to(`job:${jobId}`).emit('job-progress', notification);
  io.to(`user:${userId}`).emit('job-progress', notification);

  logger.debug('Job progress notification sent', {
    jobId,
    userId,
    progress,
    message
  });
}

// Queue statistics notifications (admin only)
export function notifyQueueStats(stats: any): void {
  if (!io) return;

  const notification = {
    type: 'queue-stats',
    stats,
    timestamp: new Date().toISOString()
  };

  io.to('queue-stats').emit('queue-stats-update', notification);

  logger.debug('Queue stats notification sent to admins');
}

// System notifications
export function notifySystemEvent(event: string, data: any): void {
  if (!io) return;

  const notification = {
    type: 'system-event',
    event,
    data,
    timestamp: new Date().toISOString()
  };

  // Send to all connected clients
  io.emit('system-event', notification);

  logger.info('System event notification sent', { event });
}

// Worker health notifications (admin only)
export function notifyWorkerHealth(workerId: string, status: any): void {
  if (!io) return;

  const notification = {
    type: 'worker-health',
    workerId,
    status,
    timestamp: new Date().toISOString()
  };

  io.to('admin').emit('worker-health-update', notification);

  logger.debug('Worker health notification sent to admins', { workerId, status: status.status });
}

// Bulk notification for multiple users
export function notifyMultipleUsers(userIds: string[], event: string, data: any): void {
  if (!io) return;

  userIds.forEach(userId => {
    io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  });

  logger.debug('Bulk notification sent', {
    event,
    userCount: userIds.length
  });
}

// Get connection statistics
export function getConnectionStats(): any {
  if (!io) return null;

  const sockets = io.sockets.sockets;
  const uniqueUsers = new Set();

  sockets.forEach(socket => {
    if (socket.data.user) {
      uniqueUsers.add(socket.data.user.userId);
    }
  });

  return {
    totalConnections: sockets.size,
    uniqueUsers: uniqueUsers.size,
    adminConnections: 0,
    rooms: Array.from(io.sockets.adapter.rooms.keys()).filter(room => !sockets.has(room))
  };
}

// Broadcast job created to all users
export function broadcastJobCreated(job: any, createdBy: string): void {
  if (!io) return;

  const notification = {
    type: 'job-created',
    job,
    createdBy,
    timestamp: new Date().toISOString()
  };

  // Broadcast to all connected clients
  io.emit('job:created', notification);

  logger.debug('Job created notification broadcast', {
    jobId: job.id,
    createdBy
  });
}

// Broadcast job status change
export function broadcastJobStatusChange(jobId: string, newStatus: string, userId?: string): void {
  if (!io) return;

  const notification = {
    type: 'status-change',
    jobId,
    newStatus,
    changedBy: userId,
    timestamp: new Date().toISOString()
  };

  // Broadcast to all connected clients
  io.emit('job:status_changed', notification);

  // Also send to specific job room
  io.to(`job:${jobId}`).emit('job:status_changed', notification);

  logger.debug('Job status change notification broadcast', {
    jobId,
    newStatus,
    changedBy: userId
  });
}

// Get online users count
export function getOnlineUsersCount(): number {
  return connectedUsers.size;
}

// Get online user IDs
export function getOnlineUserIds(): string[] {
  return Array.from(connectedUsers.keys());
}

// Broadcast worker status change
export function broadcastWorkerStatus(workerId: string, status: string, currentJobId?: string): void {
  if (!io) return;

  const notification = {
    type: 'worker-status',
    workerId,
    status,
    currentJobId,
    timestamp: new Date().toISOString()
  };

  // Send to admin and manager roles only
  io.to('role:ADMIN').to('role:MANAGER').emit('worker:status_changed', notification);

  logger.debug('Worker status change broadcast', {
    workerId,
    status,
    currentJobId
  });
}

// Broadcast worker stats (pool overview)
export function broadcastWorkerStats(stats: any): void {
  if (!io) return;

  const notification = {
    type: 'worker-stats',
    ...stats,
    timestamp: new Date().toISOString()
  };

  // Send to admin and manager roles only
  io.to('role:ADMIN').to('role:MANAGER').emit('worker:stats', notification);

  logger.debug('Worker stats broadcast', {
    totalWorkers: stats.workers?.length || 0,
    activeWorkers: stats.workers?.filter((w: any) => w.status === 'busy').length || 0
  });
}

// Broadcast queue depth update
export function broadcastQueueDepth(depth: any): void {
  if (!io) return;

  const notification = {
    type: 'queue-depth',
    ...depth,
    timestamp: new Date().toISOString()
  };

  // Send to admin and manager roles only
  io.to('role:ADMIN').to('role:MANAGER').emit('queue:depth', notification);

  logger.debug('Queue depth broadcast', depth);
}

// Broadcast system alert to admins
export function broadcastSystemAlert(alert: any): void {
  if (!io) return;

  const notification = {
    type: 'system-alert',
    alert,
    timestamp: new Date().toISOString()
  };

  // Send to admin role only
  io.to('role:ADMIN').emit('system:alert', notification);

  logger.debug('System alert broadcast', {
    alertId: alert.id,
    level: alert.level,
    type: alert.type
  });
}

// ==================== PHASE 6: REAL-TIME COLLABORATION EVENTS ====================

/**
 * Broadcast new comment to job watchers
 */
export function broadcastNewComment(jobId: string, comment: any): void {
  if (!io) return;

  const notification = {
    type: 'comment-added',
    jobId,
    comment,
    timestamp: new Date().toISOString()
  };

  // Send to everyone watching this job
  io.to(`job:${jobId}`).emit('collaboration:comment_added', notification);

  logger.debug('Comment notification broadcast', {
    jobId,
    commentId: comment.id,
    userId: comment.userId
  });
}

/**
 * Broadcast comment update to job watchers
 */
export function broadcastCommentUpdate(jobId: string, comment: any): void {
  if (!io) return;

  const notification = {
    type: 'comment-updated',
    jobId,
    comment,
    timestamp: new Date().toISOString()
  };

  io.to(`job:${jobId}`).emit('collaboration:comment_updated', notification);

  logger.debug('Comment update broadcast', {
    jobId,
    commentId: comment.id
  });
}

/**
 * Broadcast comment deletion to job watchers
 */
export function broadcastCommentDelete(jobId: string, commentId: string): void {
  if (!io) return;

  const notification = {
    type: 'comment-deleted',
    jobId,
    commentId,
    timestamp: new Date().toISOString()
  };

  io.to(`job:${jobId}`).emit('collaboration:comment_deleted', notification);

  logger.debug('Comment deletion broadcast', {
    jobId,
    commentId
  });
}

/**
 * Broadcast job handoff to relevant users
 */
export function broadcastJobHandoff(jobId: string, handoff: any): void {
  if (!io) return;

  const notification = {
    type: 'job-handoff',
    jobId,
    handoff,
    timestamp: new Date().toISOString()
  };

  // Send to both users involved in the handoff
  io.to(`user:${handoff.fromUserId}`).emit('collaboration:handoff', notification);
  io.to(`user:${handoff.toUserId}`).emit('collaboration:handoff', notification);

  // Send to everyone watching the job
  io.to(`job:${jobId}`).emit('collaboration:handoff', notification);

  logger.info('Job handoff notification broadcast', {
    jobId,
    fromUserId: handoff.fromUserId,
    toUserId: handoff.toUserId
  });
}

/**
 * Broadcast @mention notification to mentioned user
 */
export function broadcastMention(userId: string, mention: any): void {
  if (!io) return;

  const notification = {
    type: 'mention',
    mention,
    timestamp: new Date().toISOString()
  };

  io.to(`user:${userId}`).emit('collaboration:mentioned', notification);

  logger.debug('@mention notification sent', {
    userId,
    jobId: mention.jobId,
    commentId: mention.commentId
  });
}

/**
 * Broadcast watcher added/removed events
 */
export function broadcastWatcherChange(jobId: string, userId: string, action: 'added' | 'removed'): void {
  if (!io) return;

  const notification = {
    type: action === 'added' ? 'watcher-added' : 'watcher-removed',
    jobId,
    userId,
    timestamp: new Date().toISOString()
  };

  // Send to everyone watching the job
  io.to(`job:${jobId}`).emit('collaboration:watcher_change', notification);

  logger.debug('Watcher change broadcast', {
    jobId,
    userId,
    action
  });
}

/**
 * Broadcast job dependency completion
 */
export function broadcastDependencyCompleted(dependentJobId: string, completedJobId: string): void {
  if (!io) return;

  const notification = {
    type: 'dependency-completed',
    dependentJobId,
    completedJobId,
    timestamp: new Date().toISOString()
  };

  // Send to everyone watching the dependent job
  io.to(`job:${dependentJobId}`).emit('job:dependency_completed', notification);

  logger.debug('Dependency completion broadcast', {
    dependentJobId,
    completedJobId
  });
}

/**
 * Get presence service instance
 */
export function getPresenceService(): PresenceService | null {
  return presenceService || null;
}

/**
 * Get online users by role (using presence service)
 */
export function getOnlineUsersByRole(role?: string): any[] {
  if (!presenceService) return [];
  return presenceService.getOnlineUsersByRole(role as any);
}

/**
 * Get job viewers (using presence service)
 */
export function getJobViewers(jobId: string): any[] {
  if (!presenceService) return [];
  return presenceService.getJobViewers(jobId);
}

export { io, presenceService };
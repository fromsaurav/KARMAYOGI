// Enhanced presence tracking service for real-time user status and job viewers
// Tracks online users, idle status, typing indicators, and job-level presence

import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient, UserRole } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface UserPresence {
  userId: string;
  userName: string;
  role: UserRole;
  socketId: string;
  status: 'online' | 'away' | 'offline';
  lastActivity: Date;
  currentJob?: string; // Job ID user is currently viewing
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  jobId: string;
  timestamp: Date;
}

export class PresenceService {
  private io: SocketIOServer;
  private users: Map<string, UserPresence> = new Map(); // userId -> UserPresence
  private socketToUser: Map<string, string> = new Map(); // socketId -> userId
  private jobViewers: Map<string, Set<string>> = new Map(); // jobId -> Set of userIds
  private typingIndicators: Map<string, TypingIndicator[]> = new Map(); // jobId -> typing users
  private idleTimeout: number = 300000; // 5 minutes idle = away
  private idleCheckInterval: NodeJS.Timeout | null = null;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.startIdleMonitoring();
  }

  /**
   * User connected to WebSocket
   */
  public userConnected(socket: Socket, userId: string, userName: string, role: UserRole): void {
    const presence: UserPresence = {
      userId,
      userName,
      role,
      socketId: socket.id,
      status: 'online',
      lastActivity: new Date()
    };

    this.users.set(userId, presence);
    this.socketToUser.set(socket.id, userId);

    logger.info(`User ${userName} (${userId}) connected - ${role}`);

    // Join role-specific room
    socket.join(`role:${role}`);
    socket.join(`user:${userId}`);

    // Broadcast updated online count to all users
    this.broadcastOnlineCount();

    // Send current online users to the newly connected user
    this.sendOnlineUsersTo(socket);
  }

  /**
   * User disconnected from WebSocket
   */
  public userDisconnected(socket: Socket): void {
    const userId = this.socketToUser.get(socket.id);
    if (!userId) return;

    const presence = this.users.get(userId);
    if (!presence) return;

    logger.info(`User ${presence.userName} (${userId}) disconnected`);

    // Remove from current job viewers if viewing a job
    if (presence.currentJob) {
      this.leaveJob(userId, presence.currentJob);
    }

    // Mark as offline
    presence.status = 'offline';
    this.users.delete(userId);
    this.socketToUser.delete(socket.id);

    // Broadcast updated online count
    this.broadcastOnlineCount();
  }

  /**
   * User joins a job view (viewing job details page)
   */
  public joinJob(userId: string, jobId: string): void {
    const presence = this.users.get(userId);
    if (!presence) return;

    // Leave previous job if viewing one
    if (presence.currentJob && presence.currentJob !== jobId) {
      this.leaveJob(userId, presence.currentJob);
    }

    presence.currentJob = jobId;
    presence.lastActivity = new Date();

    // Add to job viewers
    if (!this.jobViewers.has(jobId)) {
      this.jobViewers.set(jobId, new Set());
    }
    this.jobViewers.get(jobId)!.add(userId);

    // Join job-specific room
    const socket = this.io.sockets.sockets.get(presence.socketId);
    if (socket) {
      socket.join(`job:${jobId}`);
    }

    logger.info(`User ${userId} joined job ${jobId}`);

    // Broadcast updated viewers to everyone watching this job
    this.broadcastJobViewers(jobId);
  }

  /**
   * User leaves a job view
   */
  public leaveJob(userId: string, jobId: string): void {
    const presence = this.users.get(userId);
    if (!presence) return;

    if (presence.currentJob === jobId) {
      presence.currentJob = undefined;
    }

    // Remove from job viewers
    const viewers = this.jobViewers.get(jobId);
    if (viewers) {
      viewers.delete(userId);
      if (viewers.size === 0) {
        this.jobViewers.delete(jobId);
      }
    }

    // Leave job-specific room
    const socket = this.io.sockets.sockets.get(presence.socketId);
    if (socket) {
      socket.leave(`job:${jobId}`);
    }

    logger.info(`User ${userId} left job ${jobId}`);

    // Broadcast updated viewers
    this.broadcastJobViewers(jobId);

    // Remove typing indicator if exists
    this.removeTypingIndicator(userId, jobId);
  }

  /**
   * User is typing in a job comment field
   */
  public userTyping(userId: string, userName: string, jobId: string): void {
    const presence = this.users.get(userId);
    if (!presence) return;

    presence.lastActivity = new Date();

    // Add/update typing indicator
    if (!this.typingIndicators.has(jobId)) {
      this.typingIndicators.set(jobId, []);
    }

    const indicators = this.typingIndicators.get(jobId)!;
    const existingIndex = indicators.findIndex(t => t.userId === userId);

    const indicator: TypingIndicator = {
      userId,
      userName,
      jobId,
      timestamp: new Date()
    };

    if (existingIndex >= 0) {
      indicators[existingIndex] = indicator;
    } else {
      indicators.push(indicator);
    }

    // Broadcast typing indicator to job viewers (except the typer)
    this.io.to(`job:${jobId}`).emit('user:typing', {
      userId,
      userName,
      jobId
    });

    // Auto-remove typing indicator after 3 seconds
    setTimeout(() => {
      this.removeTypingIndicator(userId, jobId);
    }, 3000);
  }

  /**
   * Remove typing indicator
   */
  private removeTypingIndicator(userId: string, jobId: string): void {
    const indicators = this.typingIndicators.get(jobId);
    if (!indicators) return;

    const filtered = indicators.filter(t => t.userId !== userId);
    if (filtered.length === 0) {
      this.typingIndicators.delete(jobId);
    } else {
      this.typingIndicators.set(jobId, filtered);
    }

    // Broadcast stopped typing
    this.io.to(`job:${jobId}`).emit('user:stopped_typing', { userId, jobId });
  }

  /**
   * Update user activity (reset idle timer)
   */
  public updateActivity(userId: string): void {
    const presence = this.users.get(userId);
    if (!presence) return;

    presence.lastActivity = new Date();

    // If user was away, mark as online
    if (presence.status === 'away') {
      presence.status = 'online';
      this.broadcastOnlineCount();
    }
  }

  /**
   * Get online users by role
   */
  public getOnlineUsersByRole(role?: UserRole): UserPresence[] {
    const users = Array.from(this.users.values());
    if (role) {
      return users.filter(u => u.role === role && u.status !== 'offline');
    }
    return users.filter(u => u.status !== 'offline');
  }

  /**
   * Get users viewing a specific job
   */
  public getJobViewers(jobId: string): UserPresence[] {
    const viewerIds = this.jobViewers.get(jobId);
    if (!viewerIds || viewerIds.size === 0) return [];

    return Array.from(viewerIds)
      .map(userId => this.users.get(userId))
      .filter((p): p is UserPresence => p !== undefined);
  }

  /**
   * Broadcast online count to all connected clients
   */
  private broadcastOnlineCount(): void {
    const onlineByRole = {
      [UserRole.USER]: this.getOnlineUsersByRole(UserRole.USER).length,
      [UserRole.MANAGER]: this.getOnlineUsersByRole(UserRole.MANAGER).length,
      [UserRole.ADMIN]: this.getOnlineUsersByRole(UserRole.ADMIN).length,
      total: this.users.size
    };

    // Send to all users
    this.io.emit('presence:online_count', onlineByRole);

    logger.debug('Online count broadcasted:', onlineByRole);
  }

  /**
   * Send list of online users to a specific socket
   */
  private sendOnlineUsersTo(socket: Socket): void {
    const onlineUsers = Array.from(this.users.values()).map(p => ({
      userId: p.userId,
      userName: p.userName,
      role: p.role,
      status: p.status,
      currentJob: p.currentJob
    }));

    socket.emit('presence:online_users', onlineUsers);
  }

  /**
   * Broadcast job viewers to everyone watching the job
   */
  private broadcastJobViewers(jobId: string): void {
    const viewers = this.getJobViewers(jobId);

    const viewerData = viewers.map(v => ({
      userId: v.userId,
      userName: v.userName,
      role: v.role,
      status: v.status
    }));

    this.io.to(`job:${jobId}`).emit('presence:job_viewers', {
      jobId,
      viewers: viewerData,
      count: viewers.length
    });
  }

  /**
   * Start monitoring for idle users
   */
  private startIdleMonitoring(): void {
    this.idleCheckInterval = setInterval(() => {
      const now = Date.now();

      for (const [userId, presence] of this.users.entries()) {
        const idleTime = now - presence.lastActivity.getTime();

        if (idleTime >= this.idleTimeout && presence.status === 'online') {
          presence.status = 'away';
          logger.info(`User ${userId} marked as away due to inactivity`);
          this.broadcastOnlineCount();
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Stop idle monitoring (cleanup)
   */
  public stopIdleMonitoring(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
  }

  /**
   * Get presence status for a specific user
   */
  public getUserPresence(userId: string): UserPresence | undefined {
    return this.users.get(userId);
  }

  /**
   * Get all typing indicators for a job
   */
  public getTypingIndicators(jobId: string): TypingIndicator[] {
    return this.typingIndicators.get(jobId) || [];
  }

  /**
   * Cleanup - stop monitoring and clear all data
   */
  public cleanup(): void {
    this.stopIdleMonitoring();
    this.users.clear();
    this.socketToUser.clear();
    this.jobViewers.clear();
    this.typingIndicators.clear();
    logger.info('PresenceService cleaned up');
  }
}

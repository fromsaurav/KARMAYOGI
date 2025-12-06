import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from '@/constants';
import { Job } from '@/types';
import { useJobStore } from '@/stores/jobStore';
import { useAuthStore } from '@/stores/authStore';

interface UseWebSocketOptions {
  onJobCreated?: (data: any) => void;
  onJobStatusChanged?: (data: any) => void;
  onJobProgress?: (data: any) => void;
  onUserConnected?: (data: any) => void;
  onUserDisconnected?: (data: any) => void;
  onWorkerStats?: (data: any) => void;
  onWorkerStatusChanged?: (data: any) => void;
  onQueueDepth?: (data: any) => void;
  // Phase 6: Real-time collaboration events
  onCommentAdded?: (data: any) => void;
  onCommentUpdated?: (data: any) => void;
  onCommentDeleted?: (data: any) => void;
  onJobHandoff?: (data: any) => void;
  onMentioned?: (data: any) => void;
  onWatcherChange?: (data: any) => void;
  onPresenceUpdate?: (data: any) => void;
  onJobViewers?: (data: any) => void;
  onUserTyping?: (data: any) => void;
  onUserStoppedTyping?: (data: any) => void;
  onSystemAlert?: (data: any) => void;
}

interface OnlineCount {
  USER: number;
  MANAGER: number;
  ADMIN: number;
  total: number;
}

interface WebSocketHook {
  socket: Socket | null;
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
  onlineUsers: string[];
  onlineUsersCount: number;
  onlineCount: OnlineCount | null;
  subscribeToJob: (jobId: string) => void;
  unsubscribeFromJob: (jobId: string) => void;
  emitTyping: (jobId: string) => void;
  emitActivity: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): WebSocketHook {
  const socketRef = useRef<Socket | null>(null);
  const { isAuthenticated } = useAuthStore();
  const { updateJob } = useJobStore();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [onlineCount, setOnlineCount] = useState<OnlineCount | null>(null);

  const getToken = () => {
    // Get token from cookie
    const cookies = document.cookie.split('; ');
    const jwtCookie = cookies.find(row => row.startsWith('jwt='));
    return jwtCookie ? jwtCookie.split('=')[1] : null;
  };

  const connect = () => {
    const token = getToken();
    if (!isAuthenticated || !token || socketRef.current) return;

    const socket = io(WS_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connected', (data) => {
      // Connection confirmed
    });

    // Handle online users list
    socket.on('users:online', (data: { users: string[]; count: number }) => {
      setOnlineUsers(data.users);
    });

    // Handle user connected
    socket.on('user:connected', (data: { userId: string; email: string; role: string }) => {
      setOnlineUsers(prev => [...prev, data.userId]);
      options.onUserConnected?.(data);
    });

    // Handle user disconnected
    socket.on('user:disconnected', (data: { userId: string }) => {
      setOnlineUsers(prev => prev.filter(id => id !== data.userId));
      options.onUserDisconnected?.(data);
    });

    // Handle job created
    socket.on('job:created', (data: any) => {
      options.onJobCreated?.(data);
    });

    // Handle job status changed
    socket.on('job:status_changed', (data: any) => {
      options.onJobStatusChanged?.(data);
    });

    // Handle job progress
    socket.on('job:progress', (data: any) => {
      options.onJobProgress?.(data);
    });

    // Handle worker stats
    socket.on('worker:stats', (data: any) => {
      options.onWorkerStats?.(data);
    });

    // Handle worker status changed
    socket.on('worker:status_changed', (data: any) => {
      options.onWorkerStatusChanged?.(data);
    });

    // Handle queue depth updates
    socket.on('queue:depth', (data: any) => {
      options.onQueueDepth?.(data);
    });

    // ==================== PHASE 6: REAL-TIME COLLABORATION EVENTS ====================

    // Handle presence online count
    socket.on('presence:online_count', (data: OnlineCount) => {
      setOnlineCount(data);
      options.onPresenceUpdate?.(data);
    });

    // Handle presence online users list
    socket.on('presence:online_users', (data: any[]) => {
      setOnlineUsers(data.map(u => u.userId));
    });

    // Handle job viewers
    socket.on('presence:job_viewers', (data: any) => {
      options.onJobViewers?.(data);
    });

    // Handle user typing
    socket.on('user:typing', (data: any) => {
      options.onUserTyping?.(data);
    });

    // Handle user stopped typing
    socket.on('user:stopped_typing', (data: any) => {
      options.onUserStoppedTyping?.(data);
    });

    // Handle comment added
    socket.on('collaboration:comment_added', (data: any) => {
      options.onCommentAdded?.(data);
    });

    // Handle comment updated
    socket.on('collaboration:comment_updated', (data: any) => {
      options.onCommentUpdated?.(data);
    });

    // Handle comment deleted
    socket.on('collaboration:comment_deleted', (data: any) => {
      options.onCommentDeleted?.(data);
    });

    // Handle job handoff
    socket.on('collaboration:handoff', (data: any) => {
      options.onJobHandoff?.(data);
    });

    // Handle @mention notification
    socket.on('collaboration:mentioned', (data: any) => {
      options.onMentioned?.(data);
    });

    // Handle watcher change
    socket.on('collaboration:watcher_change', (data: any) => {
      options.onWatcherChange?.(data);
    });

    // Handle system alert (admin only)
    socket.on('system:alert', (data: any) => {
      options.onSystemAlert?.(data);
    });

    // Handle job dependency completion
    socket.on('job:dependency_completed', (data: any) => {
      // Can be handled by onJobStatusChanged or a custom handler
    });

    // Legacy event handlers (keeping for backwards compatibility)
    socket.on('job-update', (updatedJob: Job) => {
      updateJob(updatedJob);
    });

    socket.on('job-progress', (data: { jobId: string; progress: number }) => {
      // Update job progress in store
      useJobStore.getState().jobs.forEach(job => {
        if (job.id === data.jobId) {
          updateJob({ ...job, progress: data.progress });
        }
      });
    });

    socket.on('system-metrics', (_metrics) => {
      // Could update a metrics store here if needed
    });

    socket.on('error', (error) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('WebSocket error:', error);
      }
    });

    socketRef.current = socket;
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setOnlineUsers([]);
      setOnlineCount(null);
    }
  };

  // Helper function to subscribe to job updates
  const subscribeToJob = (jobId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('subscribe-job', jobId);
    }
  };

  // Helper function to unsubscribe from job updates
  const unsubscribeFromJob = (jobId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe-job', jobId);
    }
  };

  // Helper function to emit typing event
  const emitTyping = (jobId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('typing', { jobId });
    }
  };

  // Helper function to emit activity (reset idle timer)
  const emitActivity = () => {
    if (socketRef.current) {
      socketRef.current.emit('activity');
    }
  };

  useEffect(() => {
    const token = getToken();
    if (isAuthenticated && token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated]);

  return {
    socket: socketRef.current,
    connect,
    disconnect,
    isConnected,
    onlineUsers,
    onlineUsersCount: onlineUsers.length,
    onlineCount,
    subscribeToJob,
    unsubscribeFromJob,
    emitTyping,
    emitActivity
  };
}

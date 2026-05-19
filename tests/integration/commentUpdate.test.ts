// Tests for PUT /api/collaboration/comments/:commentId — R5 parent job check.
// The endpoint already checks comment ownership; this tests that it ALSO
// verifies the editor still has access to the parent job.

jest.mock('bull', () => jest.fn().mockImplementation(() => ({
  add: jest.fn().mockResolvedValue({ id: 'bull-job-id' }),
  process: jest.fn(), on: jest.fn(),
  getJob: jest.fn().mockResolvedValue(null),
  getWaiting: jest.fn().mockResolvedValue([]),
  getActive: jest.fn().mockResolvedValue([]),
  getCompleted: jest.fn().mockResolvedValue([]),
  getFailed: jest.fn().mockResolvedValue([]),
  getDelayed: jest.fn().mockResolvedValue([]),
  isPaused: jest.fn().mockResolvedValue(false),
  pause: jest.fn(), resume: jest.fn(), close: jest.fn(), clean: jest.fn(),
})));

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  on: jest.fn().mockReturnThis(),
  disconnect: jest.fn().mockResolvedValue(undefined),
})));

const mockPrisma = {
  job:            { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0) },
  jobComment:     { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  jobWatcher:     { findMany: jest.fn().mockResolvedValue([]) },
  jobHandoff:     { findMany: jest.fn().mockResolvedValue([]) },
  jobStatusChange:{ findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) },
  jobLog:         { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
  jobDependency:  { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  auditLog:       { create: jest.fn().mockResolvedValue({}) },
  user:           { findUnique: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockReturnValue(mockPrisma),
  JobType:    { FILE_PROCESSING: 'FILE_PROCESSING', DATA_ANALYTICS: 'DATA_ANALYTICS', EMAIL_TASK: 'EMAIL_TASK', API_INTEGRATION: 'API_INTEGRATION', CUSTOM_SCRIPT: 'CUSTOM_SCRIPT' },
  JobStatus:  { PENDING: 'PENDING', ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED', FAILED: 'FAILED', CANCELLED: 'CANCELLED' },
  JobPriority:{ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' },
  LogLevel:   { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' },
  UserRole:   { USER: 'USER', MANAGER: 'MANAGER', ADMIN: 'ADMIN' },
}));

jest.mock('../../src/services/websocket', () => ({
  broadcastJobCreated: jest.fn(), broadcastJobStatusChange: jest.fn(),
  broadcastNewComment: jest.fn(), broadcastCommentUpdate: jest.fn(),
  broadcastCommentDelete: jest.fn(), broadcastJobHandoff: jest.fn(),
  broadcastWatcherChange: jest.fn(),
  getConnectionStats: jest.fn().mockReturnValue({ totalConnections: 0 }),
  initializeWebSocket: jest.fn(),
}));

jest.mock('../../src/services/jobService', () => ({
  createJob: jest.fn(), getJobById: jest.fn(),
  getJobsByUser: jest.fn().mockResolvedValue({ jobs: [], total: 0 }),
  cancelJob: jest.fn().mockResolvedValue(true), retryJob: jest.fn(),
  getJobLogs: jest.fn().mockResolvedValue([]),
  getJobStats: jest.fn().mockResolvedValue({ total: 0, pending: 0, active: 0, completed: 0, failed: 0, cancelled: 0 }),
  updateJobStatus: jest.fn().mockResolvedValue({}), updateJobProgress: jest.fn(), logJobEvent: jest.fn(),
}));

jest.mock('../../src/queues/queueManager', () => ({
  addJob: jest.fn().mockResolvedValue({ id: 'bull-job-id' }),
  getJob: jest.fn().mockResolvedValue(null), removeJob: jest.fn().mockResolvedValue(true),
  getQueueStats: jest.fn().mockResolvedValue({}), initializeQueues: jest.fn(),
  queues: new Map(), getQueueByPriority: jest.fn(),
}));

jest.mock('../../src/middleware/protectRoute', () => ({ protectRoute: jest.fn() }));
jest.mock('../../src/middleware/jobAccess',    () => ({ assertJobAccess: jest.fn() }));

import request from 'supertest';
import { app } from '../../src/app';
import { protectRoute } from '../../src/middleware/protectRoute';
import { assertJobAccess } from '../../src/middleware/jobAccess';

const FORBIDDEN = Object.assign(new Error('Access denied'), { statusCode: 403 });

const setUser = (userId = 'user-1', role = 'USER') => {
  (protectRoute as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
    req.user = { id: userId, userId, fullName: 'Test', email: 't@t.com', profilePic: '', role };
    next();
  });
};

// A comment owned by user-1 on job-1
const ownedComment = { id: 'cmt-1', jobId: 'job-1', userId: 'user-1', content: 'original' };
const updatedComment = { ...ownedComment, content: 'updated', user: { id: 'user-1', fullName: 'Test', email: 't@t.com', profilePic: '' } };

describe('PUT /api/collaboration/comments/:commentId — parent job access (R5)', () => {
  beforeEach(() => {
    mockPrisma.jobComment.update.mockResolvedValue(updatedComment);
  });

  it('returns 200 when user owns the comment and has job access', async () => {
    setUser('user-1', 'USER');
    mockPrisma.jobComment.findUnique.mockResolvedValue(ownedComment);
    (assertJobAccess as jest.Mock).mockResolvedValue({ id: 'job-1', userId: 'user-1' });

    const res = await request(app)
      .put('/api/collaboration/comments/cmt-1')
      .send({ content: 'updated' });

    expect(res.status).toBe(200);
    expect(assertJobAccess).toHaveBeenCalledWith('job-1', 'user-1', 'USER');
    expect(mockPrisma.jobComment.update).toHaveBeenCalled();
  });

  it('returns 403 when user owns the comment but job access is denied', async () => {
    setUser('user-1', 'USER');
    mockPrisma.jobComment.findUnique.mockResolvedValue(ownedComment);
    (assertJobAccess as jest.Mock).mockRejectedValue(FORBIDDEN);

    const res = await request(app)
      .put('/api/collaboration/comments/cmt-1')
      .send({ content: 'updated' });

    expect(res.status).toBe(403);
    expect(mockPrisma.jobComment.update).not.toHaveBeenCalled();
  });

  it('returns 403 when user does not own the comment (job check never reached)', async () => {
    setUser('user-2', 'USER');
    mockPrisma.jobComment.findUnique.mockResolvedValue(ownedComment); // owned by user-1

    const res = await request(app)
      .put('/api/collaboration/comments/cmt-1')
      .send({ content: 'updated' });

    expect(res.status).toBe(403);
    expect(assertJobAccess).not.toHaveBeenCalled();
    expect(mockPrisma.jobComment.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the comment does not exist', async () => {
    setUser('user-1', 'USER');
    mockPrisma.jobComment.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/collaboration/comments/nonexistent')
      .send({ content: 'updated' });

    expect(res.status).toBe(404);
    expect(assertJobAccess).not.toHaveBeenCalled();
  });

  it('assertJobAccess receives the parent jobId from the comment record', async () => {
    setUser('user-1', 'USER');
    mockPrisma.jobComment.findUnique.mockResolvedValue({ ...ownedComment, jobId: 'job-xyz' });
    (assertJobAccess as jest.Mock).mockResolvedValue({ id: 'job-xyz', userId: 'user-1' });

    await request(app)
      .put('/api/collaboration/comments/cmt-1')
      .send({ content: 'updated' });

    expect(assertJobAccess).toHaveBeenCalledWith('job-xyz', 'user-1', 'USER');
  });
});

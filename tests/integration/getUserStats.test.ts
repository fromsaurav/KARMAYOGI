// Tests for GET /api/dashboard/user/stats — P4: single groupBy replaces 5 count queries.
// Asserts job.count is never called and the stats object is computed correctly
// from a groupBy result that may have sparse status rows.

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
  job: {
    groupBy:    jest.fn(),
    count:      jest.fn(),
    findMany:   jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn().mockResolvedValue({}),
  },
  jobComment:      { findMany: jest.fn().mockResolvedValue([]) },
  jobWatcher:      { findMany: jest.fn().mockResolvedValue([]) },
  jobHandoff:      { findMany: jest.fn().mockResolvedValue([]) },
  jobStatusChange: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) },
  jobLog:          { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
  jobDependency:   { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  auditLog:        { create: jest.fn().mockResolvedValue({}) },
  user:            { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
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

import request from 'supertest';
import { app } from '../../src/app';
import { protectRoute } from '../../src/middleware/protectRoute';

const setUser = (userId = 'user-1', role = 'USER') => {
  (protectRoute as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
    req.user = { id: userId, userId, fullName: 'Test', email: 't@t.com', profilePic: '', role };
    next();
  });
};

describe('GET /api/dashboard/user/stats — groupBy optimization (P4)', () => {
  beforeEach(() => {
    mockPrisma.job.findMany.mockResolvedValue([]);
  });

  it('never calls job.count — uses groupBy instead', async () => {
    setUser();
    mockPrisma.job.groupBy.mockResolvedValue([
      { status: 'COMPLETED', _count: { id: 5 } },
      { status: 'ACTIVE',    _count: { id: 2 } },
      { status: 'PENDING',   _count: { id: 3 } },
    ]);

    await request(app).get('/api/dashboard/user/stats');

    expect(mockPrisma.job.groupBy).toHaveBeenCalledTimes(1);
    expect(mockPrisma.job.count).not.toHaveBeenCalled();
  });

  it('computes stats correctly from groupBy rows', async () => {
    setUser();
    mockPrisma.job.groupBy.mockResolvedValue([
      { status: 'COMPLETED', _count: { id: 10 } },
      { status: 'ACTIVE',    _count: { id: 3 } },
      { status: 'FAILED',    _count: { id: 2 } },
      { status: 'PENDING',   _count: { id: 5 } },
    ]);

    const res = await request(app).get('/api/dashboard/user/stats');

    expect(res.status).toBe(200);
    expect(res.body.data.stats).toMatchObject({
      total:     20,
      completed: 10,
      active:    3,
      failed:    2,
      pending:   5,
    });
  });

  it('returns zero counts when user has no jobs (empty groupBy result)', async () => {
    setUser();
    mockPrisma.job.groupBy.mockResolvedValue([]);

    const res = await request(app).get('/api/dashboard/user/stats');

    expect(res.status).toBe(200);
    expect(res.body.data.stats).toMatchObject({
      total: 0, completed: 0, active: 0, failed: 0, pending: 0, completionRate: 0,
    });
  });

  it('handles sparse groupBy result (missing status rows default to 0)', async () => {
    setUser();
    // Only COMPLETED rows — ACTIVE/FAILED/PENDING are absent
    mockPrisma.job.groupBy.mockResolvedValue([
      { status: 'COMPLETED', _count: { id: 7 } },
    ]);

    const res = await request(app).get('/api/dashboard/user/stats');

    expect(res.status).toBe(200);
    expect(res.body.data.stats).toMatchObject({
      total: 7, completed: 7, active: 0, failed: 0, pending: 0, completionRate: 100,
    });
  });

  it('groupBy is called with the requesting user id as filter', async () => {
    setUser('user-xyz');
    mockPrisma.job.groupBy.mockResolvedValue([]);

    await request(app).get('/api/dashboard/user/stats');

    expect(mockPrisma.job.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-xyz' } })
    );
  });
});

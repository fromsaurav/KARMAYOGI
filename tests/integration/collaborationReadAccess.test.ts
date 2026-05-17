// Regression tests for R2, R3, R6: read-side access control on collaboration endpoints.
// assertJobAccess is mocked so tests control exactly when it allows or denies access
// without needing a real database or job records.

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

jest.mock('@prisma/client', () => {
  const instance = {
    job: {
      create: jest.fn(), findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    jobComment:     { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    jobWatcher:     { findMany: jest.fn().mockResolvedValue([]) },
    jobHandoff:     { findMany: jest.fn().mockResolvedValue([]) },
    jobStatusChange:{ findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) },
    jobLog:         { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    jobDependency:  { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    auditLog:       { create: jest.fn().mockResolvedValue({}) },
    user:           { findUnique: jest.fn() },
  };
  return {
    PrismaClient: jest.fn().mockReturnValue(instance),
    JobType:   { FILE_PROCESSING: 'FILE_PROCESSING', DATA_ANALYTICS: 'DATA_ANALYTICS', EMAIL_TASK: 'EMAIL_TASK', API_INTEGRATION: 'API_INTEGRATION', CUSTOM_SCRIPT: 'CUSTOM_SCRIPT' },
    JobStatus: { PENDING: 'PENDING', ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED', FAILED: 'FAILED', CANCELLED: 'CANCELLED' },
    JobPriority: { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' },
    LogLevel:  { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' },
    UserRole:  { USER: 'USER', MANAGER: 'MANAGER', ADMIN: 'ADMIN' },
  };
});

jest.mock('../../src/services/websocket', () => ({
  broadcastJobCreated: jest.fn(),
  broadcastJobStatusChange: jest.fn(),
  broadcastNewComment: jest.fn(),
  broadcastCommentUpdate: jest.fn(),
  broadcastCommentDelete: jest.fn(),
  broadcastJobHandoff: jest.fn(),
  broadcastWatcherChange: jest.fn(),
  getConnectionStats: jest.fn().mockReturnValue({ totalConnections: 0 }),
  initializeWebSocket: jest.fn(),
}));

jest.mock('../../src/services/jobService', () => ({
  createJob: jest.fn(), getJobById: jest.fn(),
  getJobsByUser: jest.fn().mockResolvedValue({ jobs: [], total: 0 }),
  cancelJob: jest.fn().mockResolvedValue(true),
  retryJob: jest.fn(), getJobLogs: jest.fn().mockResolvedValue([]),
  getJobStats: jest.fn().mockResolvedValue({ total: 0, pending: 0, active: 0, completed: 0, failed: 0, cancelled: 0 }),
  updateJobStatus: jest.fn().mockResolvedValue({}),
  updateJobProgress: jest.fn(), logJobEvent: jest.fn(),
}));

jest.mock('../../src/queues/queueManager', () => ({
  addJob: jest.fn().mockResolvedValue({ id: 'bull-job-id' }),
  getJob: jest.fn().mockResolvedValue(null),
  removeJob: jest.fn().mockResolvedValue(true),
  getQueueStats: jest.fn().mockResolvedValue({}),
  initializeQueues: jest.fn(), queues: new Map(), getQueueByPriority: jest.fn(),
}));

jest.mock('../../src/middleware/protectRoute', () => ({ protectRoute: jest.fn() }));

// Central mock — each test controls allow vs. deny
jest.mock('../../src/middleware/jobAccess', () => ({ assertJobAccess: jest.fn() }));

import request from 'supertest';
import { app } from '../../src/app';
import { protectRoute } from '../../src/middleware/protectRoute';
import { assertJobAccess } from '../../src/middleware/jobAccess';

const FORBIDDEN = Object.assign(new Error('Access denied'), { statusCode: 403 });
const NOT_FOUND  = Object.assign(new Error('Job not found'),  { statusCode: 404 });

const setUser = (role: string, userId = 'user-1') => {
  (protectRoute as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
    req.user = { id: userId, userId, fullName: 'Test', email: 't@t.com', profilePic: '', role };
    next();
  });
};

const allow = () => (assertJobAccess as jest.Mock).mockResolvedValue({ id: 'job-1', userId: 'user-1' });
const deny  = () => (assertJobAccess as jest.Mock).mockRejectedValue(FORBIDDEN);
const miss  = () => (assertJobAccess as jest.Mock).mockRejectedValue(NOT_FOUND);

// ─── R2: GET /api/collaboration/jobs/:jobId/comments ───────────────────────

describe('GET /api/collaboration/jobs/:jobId/comments — access control (R2)', () => {
  it('returns 200 when USER owns the job', async () => {
    setUser('USER'); allow();
    const res = await request(app).get('/api/collaboration/jobs/job-1/comments');
    expect(res.status).toBe(200);
    expect(assertJobAccess).toHaveBeenCalledWith('job-1', 'user-1', 'USER');
  });

  it('returns 403 when USER tries to read another user\'s job comments', async () => {
    setUser('USER'); deny();
    const res = await request(app).get('/api/collaboration/jobs/job-other/comments');
    expect(res.status).toBe(403);
  });

  it('returns 200 when MANAGER accesses a team job', async () => {
    setUser('MANAGER', 'mgr-1'); allow();
    const res = await request(app).get('/api/collaboration/jobs/job-1/comments');
    expect(res.status).toBe(200);
  });

  it('returns 200 when ADMIN accesses any job', async () => {
    setUser('ADMIN', 'admin-1'); allow();
    const res = await request(app).get('/api/collaboration/jobs/job-1/comments');
    expect(res.status).toBe(200);
  });

  it('returns 404 when the job does not exist', async () => {
    setUser('USER'); miss();
    const res = await request(app).get('/api/collaboration/jobs/nonexistent/comments');
    expect(res.status).toBe(404);
  });
});

// ─── R3: GET /api/collaboration/jobs/:jobId/watchers ──────────────────────

describe('GET /api/collaboration/jobs/:jobId/watchers — access control (R3)', () => {
  it('returns 200 when USER owns the job', async () => {
    setUser('USER'); allow();
    const res = await request(app).get('/api/collaboration/jobs/job-1/watchers');
    expect(res.status).toBe(200);
    expect(assertJobAccess).toHaveBeenCalledWith('job-1', 'user-1', 'USER');
  });

  it('returns 403 when USER tries to read another user\'s job watchers', async () => {
    setUser('USER'); deny();
    const res = await request(app).get('/api/collaboration/jobs/job-other/watchers');
    expect(res.status).toBe(403);
  });

  it('returns 200 when MANAGER accesses a team job', async () => {
    setUser('MANAGER', 'mgr-1'); allow();
    const res = await request(app).get('/api/collaboration/jobs/job-1/watchers');
    expect(res.status).toBe(200);
  });

  it('returns 200 when ADMIN accesses any job', async () => {
    setUser('ADMIN', 'admin-1'); allow();
    const res = await request(app).get('/api/collaboration/jobs/job-1/watchers');
    expect(res.status).toBe(200);
  });

  it('returns 404 when the job does not exist', async () => {
    setUser('USER'); miss();
    const res = await request(app).get('/api/collaboration/jobs/nonexistent/watchers');
    expect(res.status).toBe(404);
  });
});

// ─── R6: GET /api/collaboration/jobs/:jobId/activity ──────────────────────

describe('GET /api/collaboration/jobs/:jobId/activity — access control (R6)', () => {
  it('returns 200 when USER owns the job', async () => {
    setUser('USER'); allow();
    const res = await request(app).get('/api/collaboration/jobs/job-1/activity');
    expect(res.status).toBe(200);
    expect(assertJobAccess).toHaveBeenCalledWith('job-1', 'user-1', 'USER');
  });

  it('returns 403 when USER tries to read another user\'s job activity', async () => {
    setUser('USER'); deny();
    const res = await request(app).get('/api/collaboration/jobs/job-other/activity');
    expect(res.status).toBe(403);
  });

  it('returns 200 when MANAGER accesses a team job', async () => {
    setUser('MANAGER', 'mgr-1'); allow();
    const res = await request(app).get('/api/collaboration/jobs/job-1/activity');
    expect(res.status).toBe(200);
  });

  it('returns 200 when ADMIN accesses any job', async () => {
    setUser('ADMIN', 'admin-1'); allow();
    const res = await request(app).get('/api/collaboration/jobs/job-1/activity');
    expect(res.status).toBe(200);
  });

  it('returns 404 when the job does not exist', async () => {
    setUser('USER'); miss();
    const res = await request(app).get('/api/collaboration/jobs/nonexistent/activity');
    expect(res.status).toBe(404);
  });
});

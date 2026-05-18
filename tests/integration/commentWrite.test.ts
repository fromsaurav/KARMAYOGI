// Tests for POST /api/collaboration/jobs/:jobId/comments — R4 write access fix.
// Verifies assertJobAccess gates comment creation and that 400/403/404 are
// returned before any DB write occurs.

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
  jobComment:     { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
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

const fakeComment = { id: 'cmt-1', jobId: 'job-1', userId: 'user-1', content: 'hello', createdAt: new Date(), user: { id: 'user-1', fullName: 'Test', email: 't@t.com', profilePic: '' } };

describe('POST /api/collaboration/jobs/:jobId/comments — write access (R4)', () => {
  beforeEach(() => {
    mockPrisma.jobComment.create.mockResolvedValue(fakeComment);
  });

  it('returns 201 when USER posts a comment on their own job', async () => {
    setUser('USER'); allow();
    const res = await request(app)
      .post('/api/collaboration/jobs/job-1/comments')
      .send({ content: 'hello' });
    expect(res.status).toBe(201);
    expect(assertJobAccess).toHaveBeenCalledWith('job-1', 'user-1', 'USER');
    expect(mockPrisma.jobComment.create).toHaveBeenCalled();
  });

  it('returns 403 and does not create comment when USER targets another user\'s job', async () => {
    setUser('USER'); deny();
    const res = await request(app)
      .post('/api/collaboration/jobs/job-other/comments')
      .send({ content: 'hello' });
    expect(res.status).toBe(403);
    expect(mockPrisma.jobComment.create).not.toHaveBeenCalled();
  });

  it('returns 201 when MANAGER posts a comment on a team job', async () => {
    setUser('MANAGER', 'mgr-1'); allow();
    const res = await request(app)
      .post('/api/collaboration/jobs/job-1/comments')
      .send({ content: 'hello' });
    expect(res.status).toBe(201);
  });

  it('returns 201 when ADMIN posts a comment on any job', async () => {
    setUser('ADMIN', 'admin-1'); allow();
    const res = await request(app)
      .post('/api/collaboration/jobs/job-1/comments')
      .send({ content: 'hello' });
    expect(res.status).toBe(201);
  });

  it('returns 404 when the job does not exist', async () => {
    setUser('USER'); miss();
    const res = await request(app)
      .post('/api/collaboration/jobs/nonexistent/comments')
      .send({ content: 'hello' });
    expect(res.status).toBe(404);
    expect(mockPrisma.jobComment.create).not.toHaveBeenCalled();
  });

  it('returns 400 when content is empty (access passes, body invalid)', async () => {
    setUser('USER'); allow();
    const res = await request(app)
      .post('/api/collaboration/jobs/job-1/comments')
      .send({ content: '   ' });
    expect(res.status).toBe(400);
    expect(mockPrisma.jobComment.create).not.toHaveBeenCalled();
  });
});

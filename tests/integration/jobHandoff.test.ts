// Tests for POST /api/collaboration/jobs/:jobId/handoff — R7 active-user guard.
// Verifies that handoff is rejected when toUserId resolves to an inactive user,
// and succeeds when all conditions are met.

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
  jobHandoff:     { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
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

import request from 'supertest';
import { app } from '../../src/app';
import { protectRoute } from '../../src/middleware/protectRoute';

const setUser = (userId = 'user-1') => {
  (protectRoute as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
    req.user = { id: userId, userId, fullName: 'Owner', email: 'o@t.com', profilePic: '', role: 'USER' };
    next();
  });
};

const ownedJob = { id: 'job-1', userId: 'user-1' };
const handoffRecord = {
  id: 'hoff-1', jobId: 'job-1', fromUserId: 'user-1', toUserId: 'user-2',
  fromUser: { id: 'user-1', fullName: 'Owner', email: 'o@t.com' },
  toUser:   { id: 'user-2', fullName: 'Recipient', email: 'r@t.com' }
};

describe('POST /api/collaboration/jobs/:jobId/handoff — active-user guard (R7)', () => {
  beforeEach(() => {
    mockPrisma.job.findUnique.mockResolvedValue(ownedJob);
    mockPrisma.job.update.mockResolvedValue({ ...ownedJob, userId: 'user-2' });
    mockPrisma.jobHandoff.create.mockResolvedValue(handoffRecord);
  });

  it('returns 200 when toUser is active', async () => {
    setUser('user-1');
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', isActive: true });

    const res = await request(app)
      .post('/api/collaboration/jobs/job-1/handoff')
      .send({ toUserId: 'user-2', message: 'Taking over' });

    expect(res.status).toBe(200);
    expect(mockPrisma.job.update).toHaveBeenCalled();
    expect(mockPrisma.jobHandoff.create).toHaveBeenCalled();
  });

  it('returns 422 when toUser exists but is inactive', async () => {
    setUser('user-1');
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', isActive: false });

    const res = await request(app)
      .post('/api/collaboration/jobs/job-1/handoff')
      .send({ toUserId: 'user-2' });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/inactive/i);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
    expect(mockPrisma.jobHandoff.create).not.toHaveBeenCalled();
  });

  it('returns 404 when toUser does not exist', async () => {
    setUser('user-1');
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/collaboration/jobs/job-1/handoff')
      .send({ toUserId: 'ghost-user' });

    expect(res.status).toBe(404);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('returns 400 when toUserId is missing from body', async () => {
    setUser('user-1');

    const res = await request(app)
      .post('/api/collaboration/jobs/job-1/handoff')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 403 when requester does not own the job', async () => {
    setUser('user-999');
    mockPrisma.job.findUnique.mockResolvedValue(ownedJob); // owned by user-1

    const res = await request(app)
      .post('/api/collaboration/jobs/job-1/handoff')
      .send({ toUserId: 'user-2' });

    expect(res.status).toBe(403);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});

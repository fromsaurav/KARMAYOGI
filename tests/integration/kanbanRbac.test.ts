// Regression test for R1: GET /api/jobs/kanban must scope jobs to the requesting user.
// Before the fix the endpoint returned every job in the system to any authenticated user.
// Regular users (USER role) must only see their own jobs; managers and admins see all.

jest.mock('bull', () => jest.fn().mockImplementation(() => ({
  add: jest.fn().mockResolvedValue({ id: 'bull-job-id' }),
  process: jest.fn(),
  on: jest.fn(),
  getJob: jest.fn().mockResolvedValue(null),
  getWaiting: jest.fn().mockResolvedValue([]),
  getActive: jest.fn().mockResolvedValue([]),
  getCompleted: jest.fn().mockResolvedValue([]),
  getFailed: jest.fn().mockResolvedValue([]),
  getDelayed: jest.fn().mockResolvedValue([]),
  isPaused: jest.fn().mockResolvedValue(false),
  pause: jest.fn(),
  resume: jest.fn(),
  close: jest.fn(),
  clean: jest.fn(),
})));

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  on: jest.fn().mockReturnThis(),
  disconnect: jest.fn().mockResolvedValue(undefined),
})));

const mockPrismaInstance = {
  job: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
  },
  jobLog: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
  jobDependency: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  jobStatusChange: { create: jest.fn().mockResolvedValue({}) },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
  user: { findUnique: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockReturnValue(mockPrismaInstance),
  JobType: {
    FILE_PROCESSING: 'FILE_PROCESSING',
    DATA_ANALYTICS: 'DATA_ANALYTICS',
    EMAIL_TASK: 'EMAIL_TASK',
    API_INTEGRATION: 'API_INTEGRATION',
    CUSTOM_SCRIPT: 'CUSTOM_SCRIPT',
  },
  JobStatus: { PENDING: 'PENDING', ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED', FAILED: 'FAILED', CANCELLED: 'CANCELLED' },
  JobPriority: { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' },
  LogLevel: { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' },
  UserRole: { USER: 'USER', MANAGER: 'MANAGER', ADMIN: 'ADMIN' },
}));

jest.mock('../../src/services/websocket', () => ({
  broadcastJobCreated: jest.fn(),
  broadcastJobStatusChange: jest.fn(),
  getConnectionStats: jest.fn().mockReturnValue({ totalConnections: 0 }),
  initializeWebSocket: jest.fn(),
}));

jest.mock('../../src/services/jobService', () => ({
  createJob: jest.fn(),
  getJobById: jest.fn(),
  getJobsByUser: jest.fn().mockResolvedValue({ jobs: [], total: 0 }),
  cancelJob: jest.fn().mockResolvedValue(true),
  retryJob: jest.fn(),
  getJobLogs: jest.fn().mockResolvedValue([]),
  getJobStats: jest.fn().mockResolvedValue({ total: 0, pending: 0, active: 0, completed: 0, failed: 0, cancelled: 0 }),
  updateJobStatus: jest.fn().mockResolvedValue({}),
  updateJobProgress: jest.fn(),
  logJobEvent: jest.fn(),
}));

jest.mock('../../src/queues/queueManager', () => ({
  addJob: jest.fn().mockResolvedValue({ id: 'bull-job-id' }),
  getJob: jest.fn().mockResolvedValue(null),
  removeJob: jest.fn().mockResolvedValue(true),
  getQueueStats: jest.fn().mockResolvedValue({}),
  initializeQueues: jest.fn(),
  queues: new Map(),
  getQueueByPriority: jest.fn(),
}));

jest.mock('../../src/middleware/protectRoute', () => ({
  protectRoute: jest.fn(),
}));

import request from 'supertest';
import { app } from '../../src/app';
import { protectRoute } from '../../src/middleware/protectRoute';

const setUser = (role: string, userId = 'user-1') => {
  (protectRoute as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
    req.user = { id: userId, userId, fullName: 'Test User', email: 'test@test.com', profilePic: '', role };
    next();
  });
};

const makeDbJob = (userId: string, id: string) => ({
  id,
  userId,
  type: 'EMAIL_TASK',
  status: 'pending',
  priority: 'MEDIUM',
  payload: {},
  progress: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: userId, email: `${userId}@test.com`, fullName: userId },
});

describe('GET /api/jobs/kanban — ownership scoping (R1)', () => {
  beforeEach(() => {
    mockPrismaInstance.job.findMany.mockResolvedValue([]);
  });

  it('passes { userId } in the where clause for USER role', async () => {
    setUser('USER', 'user-abc');

    await request(app).get('/api/jobs/kanban');

    const findManyCall = mockPrismaInstance.job.findMany.mock.calls[0][0];
    expect(findManyCall.where).toEqual({ userId: 'user-abc' });
  });

  it('passes empty where clause for MANAGER role (sees all jobs)', async () => {
    setUser('MANAGER', 'mgr-1');

    await request(app).get('/api/jobs/kanban');

    const findManyCall = mockPrismaInstance.job.findMany.mock.calls[0][0];
    expect(findManyCall.where).toEqual({});
  });

  it('passes empty where clause for ADMIN role (sees all jobs)', async () => {
    setUser('ADMIN', 'admin-1');

    await request(app).get('/api/jobs/kanban');

    const findManyCall = mockPrismaInstance.job.findMany.mock.calls[0][0];
    expect(findManyCall.where).toEqual({});
  });

  it('USER only receives their own jobs in the response', async () => {
    setUser('USER', 'user-1');
    const ownJob = makeDbJob('user-1', 'job-own');
    mockPrismaInstance.job.findMany.mockResolvedValue([ownJob]);

    const res = await request(app).get('/api/jobs/kanban');

    expect(res.status).toBe(200);
    const allJobs = Object.values(res.body.jobs).flat() as any[];
    expect(allJobs.every((j: any) => j.id === 'job-own')).toBe(true);
  });

  it('uses take: 200 not the old hardcoded 1000', async () => {
    setUser('USER', 'user-1');

    await request(app).get('/api/jobs/kanban');

    const findManyCall = mockPrismaInstance.job.findMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(200);
  });
});

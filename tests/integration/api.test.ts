// Integration tests for the REST API layer
// Tests authentication enforcement, RBAC, and request validation
// External services (Prisma, Bull, Redis, WebSocket) are mocked so no live infrastructure is needed

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

jest.mock('@prisma/client', () => {
  const instance = {
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
    // auditLog middleware calls prisma.auditLog.create() on every response — must exist in mock
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    user: { findUnique: jest.fn() },
  };
  return {
    PrismaClient: jest.fn().mockReturnValue(instance),
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
  };
});

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
  updateJobStatus: jest.fn(),
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
import * as jobService from '../../src/services/jobService';

const setUser = (role: string, userId = 'user-1') => {
  (protectRoute as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
    req.user = {
      id: userId,
      userId,
      fullName: 'Test User',
      email: 'test@test.com',
      profilePic: '',
      role,
    };
    next();
  });
};

const blockAuth = () => {
  (protectRoute as jest.Mock).mockImplementation((_req: any, res: any, _next: any) => {
    res.status(401).json({ message: 'Unauthorized - No token provided' });
  });
};

describe('API — authentication enforcement', () => {
  beforeEach(() => {
    blockAuth();
  });

  it('returns 401 for GET /api/jobs when no JWT is provided', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(401);
  });

  it('returns 401 for POST /api/jobs when no JWT is provided', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({ type: 'EMAIL_TASK', payload: { subject: 'hi' } });
    expect(res.status).toBe(401);
  });

  it('returns 401 for GET /api/jobs/:jobId when no JWT is provided', async () => {
    const res = await request(app).get('/api/jobs/some-job-id');
    expect(res.status).toBe(401);
  });
});

describe('API — RBAC enforcement on /api/jobs/metrics', () => {
  it('returns 403 when a USER role accesses the metrics endpoint', async () => {
    setUser('USER');
    const res = await request(app).get('/api/jobs/metrics');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('returns 200 when a MANAGER role accesses the metrics endpoint', async () => {
    setUser('MANAGER');
    (jobService.getJobStats as jest.Mock).mockResolvedValue({
      total: 10, pending: 2, active: 1, completed: 6, failed: 1, cancelled: 0,
    });
    const res = await request(app).get('/api/jobs/metrics');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 200 when an ADMIN role accesses the metrics endpoint', async () => {
    setUser('ADMIN');
    const res = await request(app).get('/api/jobs/metrics');
    expect(res.status).toBe(200);
  });
});

describe('API — POST /api/jobs request validation', () => {
  beforeEach(() => {
    setUser('USER');
  });

  it('returns 400 when job type is missing', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({ payload: { subject: 'test' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 400 when payload is missing', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({ type: 'EMAIL_TASK' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when job type is not one of the allowed values', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({ type: 'INVALID_TYPE', payload: {} });
    expect(res.status).toBe(400);
  });

  it('returns 400 when priority is an invalid value', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({ type: 'EMAIL_TASK', payload: {}, priority: 'ULTRA' });
    expect(res.status).toBe(400);
  });
});

describe('API — GET /api/jobs successful response shape', () => {
  beforeEach(() => {
    setUser('USER');
    (jobService.getJobsByUser as jest.Mock).mockResolvedValue({
      jobs: [
        { id: 'job-1', type: 'EMAIL_TASK', status: 'PENDING', priority: 'MEDIUM', payload: { subject: 'hi' }, userId: 'user-1', user: { id: 'user-1', email: 'test@test.com' } },
      ],
      total: 1,
    });
  });

  it('returns 200 with a jobs array and pagination metadata', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.jobs)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.total).toBe(1);
  });

  it('transforms job payload field to data field for frontend compatibility', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    const job = res.body.data.jobs[0];
    // Frontend expects 'data', not 'payload'
    expect(job.data).toBeDefined();
    expect(job.payload).toBeUndefined();
  });
});

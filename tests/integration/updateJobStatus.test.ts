// Regression test for Q1: PATCH /:jobId/status must persist the new status to the database.
// Before the fix the controller only created a jobStatusChange audit record and broadcast a
// WebSocket event — job.status was never written. This test ensures updateJobStatus from
// jobService is called so the DB record is actually updated.

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
import * as jobService from '../../src/services/jobService';

const setUser = (role: string, userId = 'user-1') => {
  (protectRoute as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
    req.user = { id: userId, userId, fullName: 'Test User', email: 'test@test.com', profilePic: '', role };
    next();
  });
};

const makeJob = (overrides: Record<string, any> = {}) => ({
  id: 'job-123',
  userId: 'user-1',
  type: 'EMAIL_TASK',
  status: 'PENDING',
  priority: 'MEDIUM',
  payload: { subject: 'test' },
  user: { id: 'user-1', email: 'test@test.com' },
  dependencies: [],
  dependents: [],
  logs: [],
  ...overrides,
});

describe('PATCH /api/jobs/:jobId/status — database write regression (Q1)', () => {
  beforeEach(() => {
    setUser('USER');
    (jobService.getJobById as jest.Mock).mockResolvedValue(makeJob());
    (jobService.updateJobStatus as jest.Mock).mockResolvedValue({});
  });

  it('calls jobService.updateJobStatus so the status is persisted to the database', async () => {
    const res = await request(app)
      .patch('/api/jobs/job-123/status')
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(jobService.updateJobStatus).toHaveBeenCalledWith('job-123', 'ACTIVE');
  });

  it('returns the new and previous status in the response body', async () => {
    const res = await request(app)
      .patch('/api/jobs/job-123/status')
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(200);
    expect(res.body.data.newStatus).toBe('COMPLETED');
    expect(res.body.data.previousStatus).toBe('PENDING');
  });

  it('returns 404 when the job does not exist', async () => {
    (jobService.getJobById as jest.Mock).mockRejectedValue(new Error('Job not found'));

    const res = await request(app)
      .patch('/api/jobs/nonexistent/status')
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid status value', async () => {
    const res = await request(app)
      .patch('/api/jobs/job-123/status')
      .send({ status: 'FLYING' });

    expect(res.status).toBe(400);
    expect(jobService.updateJobStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-admin user tries to update another user\'s job', async () => {
    (jobService.getJobById as jest.Mock).mockResolvedValue(makeJob({ userId: 'other-user' }));

    const res = await request(app)
      .patch('/api/jobs/job-123/status')
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(403);
    expect(jobService.updateJobStatus).not.toHaveBeenCalled();
  });
});

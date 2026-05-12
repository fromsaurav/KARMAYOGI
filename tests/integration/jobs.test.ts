// Integration tests for job lifecycle service functions
// Tests retryJob, cancelJob, getJobsByUser, and getJobStats behaviors
// Prisma and Bull queue are fully mocked — no live services required

const PRISMA_ENUMS = {
  JobType: {
    FILE_PROCESSING: 'FILE_PROCESSING',
    DATA_ANALYTICS: 'DATA_ANALYTICS',
    EMAIL_TASK: 'EMAIL_TASK',
    API_INTEGRATION: 'API_INTEGRATION',
    CUSTOM_SCRIPT: 'CUSTOM_SCRIPT',
  },
  JobStatus: {
    PENDING: 'PENDING',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    DELAYED: 'DELAYED',
  },
  JobPriority: { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' },
  LogLevel: { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' },
  UserRole: { USER: 'USER', MANAGER: 'MANAGER', ADMIN: 'ADMIN' },
};

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
    user: { findUnique: jest.fn() },
  };
  return { PrismaClient: jest.fn().mockReturnValue(instance), ...PRISMA_ENUMS };
});

jest.mock('../../src/queues/queueManager', () => ({
  addJob: jest.fn().mockResolvedValue({ id: 'bull-job-id' }),
  getJob: jest.fn().mockResolvedValue(null),
  removeJob: jest.fn().mockResolvedValue(true),
  getQueueStats: jest.fn().mockResolvedValue({
    'high-priority': { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: false },
    'medium-priority': { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: false },
    'low-priority': { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: false },
  }),
}));

jest.mock('uuid', () => ({ v4: jest.fn().mockReturnValue('new-job-uuid') }));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import {
  retryJob,
  cancelJob,
  getJobsByUser,
  getJobStats,
  getJobById,
} from '../../src/services/jobService';
import { addJob, removeJob } from '../../src/queues/queueManager';

const getPrisma = () => jest.requireMock('@prisma/client').PrismaClient();

const makeDbJob = (overrides: Record<string, any> = {}) => ({
  id: 'job-abc',
  userId: 'user-1',
  type: 'EMAIL_TASK',
  status: 'PENDING',
  priority: 'MEDIUM',
  payload: { subject: 'Test' },
  maxRetries: 3,
  delay: null,
  scheduledAt: null,
  startedAt: null,
  completedAt: null,
  result: null,
  error: null,
  progress: 0,
  metadata: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  user: { id: 'user-1', email: 'test@test.com' },
  dependencies: [],
  dependents: [],
  logs: [],
  ...overrides,
});

describe('retryJob — only FAILED jobs can be retried', () => {
  beforeEach(() => {
    getPrisma().job.create.mockResolvedValue(makeDbJob({ id: 'new-job-uuid', status: 'PENDING' }));
    getPrisma().jobLog.create.mockResolvedValue({});
  });

  it('throws when the job does not exist', async () => {
    getPrisma().job.findUnique.mockResolvedValue(null);
    await expect(retryJob('nonexistent-job')).rejects.toThrow('Job not found');
  });

  it('throws when the job status is PENDING (not FAILED)', async () => {
    getPrisma().job.findUnique.mockResolvedValue(makeDbJob({ status: 'PENDING' }));
    await expect(retryJob('job-abc')).rejects.toThrow('Only failed jobs can be retried');
  });

  it('throws when the job status is ACTIVE (not FAILED)', async () => {
    getPrisma().job.findUnique.mockResolvedValue(makeDbJob({ status: 'ACTIVE' }));
    await expect(retryJob('job-abc')).rejects.toThrow('Only failed jobs can be retried');
  });

  it('throws when the job status is COMPLETED (not FAILED)', async () => {
    getPrisma().job.findUnique.mockResolvedValue(makeDbJob({ status: 'COMPLETED' }));
    await expect(retryJob('job-abc')).rejects.toThrow('Only failed jobs can be retried');
  });

  it('creates a new job record when retrying a FAILED job', async () => {
    getPrisma().job.findUnique.mockResolvedValue(makeDbJob({ status: 'FAILED' }));
    const newJob = makeDbJob({ id: 'new-job-uuid', status: 'PENDING' });
    getPrisma().job.create.mockResolvedValue(newJob);

    const result = await retryJob('job-abc');

    expect(getPrisma().job.create).toHaveBeenCalled();
    expect(result.id).toBe('new-job-uuid');
  });

  it('adds the retried job to the Bull queue', async () => {
    getPrisma().job.findUnique.mockResolvedValue(makeDbJob({ status: 'FAILED' }));
    getPrisma().job.create.mockResolvedValue(makeDbJob({ id: 'new-job-uuid' }));

    await retryJob('job-abc');

    expect(addJob).toHaveBeenCalled();
  });

  it('stores retryOf metadata referencing the original job id', async () => {
    getPrisma().job.findUnique.mockResolvedValue(makeDbJob({ status: 'FAILED', id: 'original-job' }));
    getPrisma().job.create.mockResolvedValue(makeDbJob({ id: 'new-job-uuid' }));

    await retryJob('original-job');

    const createCall = getPrisma().job.create.mock.calls[0][0];
    expect(createCall.data.metadata).toMatchObject({ retryOf: 'original-job' });
  });
});

describe('cancelJob — removes job from queue and marks CANCELLED', () => {
  beforeEach(() => {
    getPrisma().job.update.mockResolvedValue(makeDbJob({ status: 'CANCELLED' }));
    getPrisma().jobLog.create.mockResolvedValue({});
  });

  it('calls removeJob to remove the job from the Bull queue', async () => {
    await cancelJob('job-abc');
    expect(removeJob).toHaveBeenCalledWith('job-abc');
  });

  it('updates the job status to CANCELLED in the database', async () => {
    await cancelJob('job-abc');

    const updateCall = getPrisma().job.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('CANCELLED');
  });
});

describe('getJobsByUser — filtering and pagination', () => {
  it('returns all jobs for a given user with total count', async () => {
    const jobs = [makeDbJob({ id: 'job-1' }), makeDbJob({ id: 'job-2' })];
    getPrisma().job.findMany.mockResolvedValue(jobs);
    getPrisma().job.count.mockResolvedValue(2);

    const result = await getJobsByUser('user-1');

    expect(result.jobs).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('passes the userId as a where condition to Prisma', async () => {
    getPrisma().job.findMany.mockResolvedValue([]);
    getPrisma().job.count.mockResolvedValue(0);

    await getJobsByUser('user-abc');

    const findManyCall = getPrisma().job.findMany.mock.calls[0][0];
    expect(findManyCall.where.userId).toBe('user-abc');
  });

  it('applies status filter when provided', async () => {
    getPrisma().job.findMany.mockResolvedValue([]);
    getPrisma().job.count.mockResolvedValue(0);

    await getJobsByUser('user-1', { status: 'FAILED' as any });

    const findManyCall = getPrisma().job.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toBe('FAILED');
  });

  it('uses the limit option to cap the result set', async () => {
    getPrisma().job.findMany.mockResolvedValue([]);
    getPrisma().job.count.mockResolvedValue(0);

    await getJobsByUser('user-1', { limit: 10 });

    const findManyCall = getPrisma().job.findMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(10);
  });
});

describe('getJobStats — aggregated counts across job statuses', () => {
  it('returns zero counts when there are no jobs', async () => {
    getPrisma().job.count.mockResolvedValue(0);

    const stats = await getJobStats('user-1');

    expect(stats.total).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.active).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.failed).toBe(0);
  });

  it('returns the correct total and per-status counts', async () => {
    // count is called 5 times: total, pending, active, completed, failed
    getPrisma().job.count
      .mockResolvedValueOnce(10)  // total
      .mockResolvedValueOnce(3)   // pending
      .mockResolvedValueOnce(2)   // active
      .mockResolvedValueOnce(4)   // completed
      .mockResolvedValueOnce(1);  // failed

    const stats = await getJobStats('user-1');

    expect(stats.total).toBe(10);
    expect(stats.pending).toBe(3);
    expect(stats.active).toBe(2);
    expect(stats.completed).toBe(4);
    expect(stats.failed).toBe(1);
  });

  it('derives cancelled count as total minus all other statuses', async () => {
    getPrisma().job.count
      .mockResolvedValueOnce(10)  // total
      .mockResolvedValueOnce(3)   // pending
      .mockResolvedValueOnce(2)   // active
      .mockResolvedValueOnce(4)   // completed
      .mockResolvedValueOnce(0);  // failed

    const stats = await getJobStats();

    // cancelled = 10 - (3 + 2 + 4 + 0) = 1
    expect(stats.cancelled).toBe(1);
  });
});

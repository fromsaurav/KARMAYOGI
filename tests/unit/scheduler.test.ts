// Tests for job scheduling and delay logic in jobService.createJob
// Verifies scheduledAt computation, maxRetries defaults, and dependency creation
// All external services (Prisma, Bull) are mocked to isolate the scheduling logic

const PRISMA_ENUMS = {
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

jest.mock('@prisma/client', () => {
  const instance = {
    job: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    jobLog: { create: jest.fn().mockResolvedValue({}) },
    jobDependency: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    jobStatusChange: { create: jest.fn().mockResolvedValue({}) },
    user: { findUnique: jest.fn() },
  };
  return {
    PrismaClient: jest.fn().mockReturnValue(instance),
    ...PRISMA_ENUMS,
  };
});

jest.mock('../../src/queues/queueManager', () => ({
  addJob: jest.fn().mockResolvedValue({ id: 'bull-job-id' }),
  getJob: jest.fn().mockResolvedValue(null),
  removeJob: jest.fn().mockResolvedValue(true),
  getQueueStats: jest.fn().mockResolvedValue({}),
}));

jest.mock('uuid', () => ({ v4: jest.fn().mockReturnValue('fixed-uuid-1234') }));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { createJob } from '../../src/services/jobService';

// Access the shared mock Prisma instance (all PrismaClient() calls return this same object)
const getPrisma = () => jest.requireMock('@prisma/client').PrismaClient();

const mockJobRecord = (overrides = {}) => ({
  id: 'fixed-uuid-1234',
  userId: 'user-1',
  type: 'EMAIL_TASK',
  status: 'PENDING',
  priority: 'MEDIUM',
  maxRetries: 3,
  delay: null,
  scheduledAt: null,
  metadata: null,
  user: { id: 'user-1', email: 'test@test.com' },
  ...overrides,
});

describe('Job scheduling — delay and scheduledAt', () => {
  beforeEach(() => {
    getPrisma().job.create.mockResolvedValue(mockJobRecord());
    getPrisma().jobLog.create.mockResolvedValue({});
  });

  it('sets scheduledAt to null when no delay option is provided', async () => {
    await createJob('user-1', 'EMAIL_TASK' as any, { subject: 'test' }, 'MEDIUM' as any);

    const createCall = getPrisma().job.create.mock.calls[0][0];
    expect(createCall.data.scheduledAt).toBeNull();
  });

  it('sets scheduledAt to Date.now() + delay when a delay is provided', async () => {
    const delay = 5000;
    const beforeCall = Date.now();

    await createJob('user-1', 'EMAIL_TASK' as any, { subject: 'test' }, 'MEDIUM' as any, { delay });

    const afterCall = Date.now();
    const createCall = getPrisma().job.create.mock.calls[0][0];
    const scheduledAt: Date = createCall.data.scheduledAt;

    expect(scheduledAt).toBeInstanceOf(Date);
    expect(scheduledAt.getTime()).toBeGreaterThanOrEqual(beforeCall + delay);
    expect(scheduledAt.getTime()).toBeLessThanOrEqual(afterCall + delay);
  });

  it('stores the delay value on the job record', async () => {
    await createJob('user-1', 'EMAIL_TASK' as any, {}, 'MEDIUM' as any, { delay: 3000 });

    const createCall = getPrisma().job.create.mock.calls[0][0];
    expect(createCall.data.delay).toBe(3000);
  });
});

describe('Job scheduling — maxRetries defaults', () => {
  beforeEach(() => {
    getPrisma().job.create.mockResolvedValue(mockJobRecord());
    getPrisma().jobLog.create.mockResolvedValue({});
  });

  it('defaults maxRetries to 3 when not specified', async () => {
    await createJob('user-1', 'DATA_ANALYTICS' as any, {}, 'LOW' as any);

    const createCall = getPrisma().job.create.mock.calls[0][0];
    expect(createCall.data.maxRetries).toBe(3);
  });

  it('uses the provided maxRetries value when specified', async () => {
    await createJob('user-1', 'DATA_ANALYTICS' as any, {}, 'HIGH' as any, { maxRetries: 7 });

    const createCall = getPrisma().job.create.mock.calls[0][0];
    expect(createCall.data.maxRetries).toBe(7);
  });

  it('creates job with PENDING status regardless of retry options', async () => {
    await createJob('user-1', 'EMAIL_TASK' as any, {}, 'MEDIUM' as any, { maxRetries: 5 });

    const createCall = getPrisma().job.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('PENDING');
  });
});

describe('Job scheduling — dependency creation', () => {
  beforeEach(() => {
    getPrisma().job.create.mockResolvedValue(mockJobRecord());
    getPrisma().jobLog.create.mockResolvedValue({});
    getPrisma().jobDependency.createMany.mockResolvedValue({ count: 1 });
  });

  it('calls jobDependency.createMany when dependencies are provided', async () => {
    const dependencies = ['parent-job-abc'];
    await createJob('user-1', 'FILE_PROCESSING' as any, {}, 'MEDIUM' as any, { dependencies });

    expect(getPrisma().jobDependency.createMany).toHaveBeenCalledWith({
      data: [{ parentJobId: 'parent-job-abc', dependentJobId: 'fixed-uuid-1234' }],
      skipDuplicates: true,
    });
  });

  it('does not call jobDependency.createMany when no dependencies are provided', async () => {
    await createJob('user-1', 'EMAIL_TASK' as any, {}, 'MEDIUM' as any);

    expect(getPrisma().jobDependency.createMany).not.toHaveBeenCalled();
  });

  it('creates dependency links for multiple parent jobs', async () => {
    const dependencies = ['parent-1', 'parent-2'];
    await createJob('user-1', 'DATA_ANALYTICS' as any, {}, 'HIGH' as any, { dependencies });

    const createManyCall = getPrisma().jobDependency.createMany.mock.calls[0][0];
    expect(createManyCall.data).toHaveLength(2);
    expect(createManyCall.data[0].parentJobId).toBe('parent-1');
    expect(createManyCall.data[1].parentJobId).toBe('parent-2');
  });
});

// Tests for job queue priority routing logic in queueManager.ts
// Verifies that jobs are dispatched to the correct Bull queue based on JobPriority enum

jest.mock('bull', () => jest.fn().mockImplementation(() => ({
  add: jest.fn().mockResolvedValue({ id: 'bull-mock-id' }),
  process: jest.fn(),
  on: jest.fn(),
  getJob: jest.fn().mockResolvedValue(null),
  getWaiting: jest.fn().mockResolvedValue([]),
  getActive: jest.fn().mockResolvedValue([]),
  getCompleted: jest.fn().mockResolvedValue([]),
  getFailed: jest.fn().mockResolvedValue([]),
  getDelayed: jest.fn().mockResolvedValue([]),
  isPaused: jest.fn().mockResolvedValue(false),
  pause: jest.fn().mockResolvedValue(undefined),
  resume: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  clean: jest.fn().mockResolvedValue(undefined),
})));

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  on: jest.fn().mockReturnThis(),
  disconnect: jest.fn().mockResolvedValue(undefined),
})));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockReturnValue({
    job: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
    jobLog: { create: jest.fn(), findMany: jest.fn() },
    user: { findUnique: jest.fn() },
  }),
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

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { queues, getQueueByPriority } from '../../src/queues/queueManager';
import { JobPriority } from '../../src/types';

const makeMockQueue = (name: string) => ({
  name,
  add: jest.fn().mockResolvedValue({ id: `${name}-job-id` }),
  getJob: jest.fn().mockResolvedValue(null),
});

describe('Queue priority routing', () => {
  beforeEach(() => {
    queues.clear();
    queues.set('high-priority', makeMockQueue('high-priority') as any);
    queues.set('medium-priority', makeMockQueue('medium-priority') as any);
    queues.set('low-priority', makeMockQueue('low-priority') as any);
  });

  afterEach(() => {
    queues.clear();
  });

  it('routes HIGH priority jobs to the high-priority queue', () => {
    const queue = getQueueByPriority(JobPriority.HIGH);
    expect((queue as any).name).toBe('high-priority');
  });

  it('routes MEDIUM priority jobs to the medium-priority queue', () => {
    const queue = getQueueByPriority(JobPriority.MEDIUM);
    expect((queue as any).name).toBe('medium-priority');
  });

  it('routes LOW priority jobs to the low-priority queue', () => {
    const queue = getQueueByPriority(JobPriority.LOW);
    expect((queue as any).name).toBe('low-priority');
  });

  it('throws an error when the queue for the given priority is not initialized', () => {
    queues.clear();
    expect(() => getQueueByPriority(JobPriority.HIGH)).toThrow('Queue not found for priority: HIGH');
  });

  it('throws an error for MEDIUM priority when only HIGH queue exists', () => {
    queues.clear();
    queues.set('high-priority', makeMockQueue('high-priority') as any);
    expect(() => getQueueByPriority(JobPriority.MEDIUM)).toThrow('Queue not found for priority: MEDIUM');
  });

  it('returns the exact queue object stored in the map', () => {
    const highQueue = makeMockQueue('high-priority') as any;
    queues.clear();
    queues.set('high-priority', highQueue);
    queues.set('medium-priority', makeMockQueue('medium-priority') as any);
    queues.set('low-priority', makeMockQueue('low-priority') as any);

    const result = getQueueByPriority(JobPriority.HIGH);
    expect(result).toBe(highQueue);
  });
});

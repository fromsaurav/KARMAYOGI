// Tests for initializeQueues — Q2: dead-letter queue must use config.redis.url,
// not the old hardcoded localhost:6379.

const REDIS_URL = 'redis://custom-redis-host:6380';

jest.mock('../../src/utils/config', () => ({
  config: {
    redis: { url: REDIS_URL },
    queue: { maxRetryAttempts: 3, retryBackoffDelay: 2000, concurrency: 5 },
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockQueueInstance = {
  on: jest.fn().mockReturnThis(),
  add: jest.fn(), process: jest.fn(), close: jest.fn(),
  getJob: jest.fn(), getWaiting: jest.fn(), getActive: jest.fn(),
  getCompleted: jest.fn(), getFailed: jest.fn(), getDelayed: jest.fn(),
  isPaused: jest.fn(), pause: jest.fn(), resume: jest.fn(), clean: jest.fn(),
};

const BullMock = jest.fn().mockReturnValue(mockQueueInstance);
jest.mock('bull', () => BullMock);

import { initializeQueues } from '../../src/queues/queueManager';

describe('initializeQueues — Redis URL config (Q2)', () => {
  beforeEach(() => {
    BullMock.mockClear();
    mockQueueInstance.on.mockReturnThis();
  });

  it('dead-letter queue is created with config.redis.url, not localhost', async () => {
    await initializeQueues();

    const deadLetterCall = BullMock.mock.calls.find(
      ([name]: [string]) => name === 'dead-letter'
    );
    expect(deadLetterCall).toBeDefined();
    expect(deadLetterCall![1]).toEqual({ redis: REDIS_URL });
  });

  it('all three priority queues also use config.redis.url', async () => {
    await initializeQueues();

    const priorityQueueNames = ['high-priority', 'medium-priority', 'low-priority'];
    for (const name of priorityQueueNames) {
      const call = BullMock.mock.calls.find(([n]: [string]) => n === name);
      expect(call).toBeDefined();
      expect(call![1].redis).toBe(REDIS_URL);
    }
  });

  it('creates exactly 4 queues (3 priority + 1 dead-letter)', async () => {
    await initializeQueues();
    expect(BullMock).toHaveBeenCalledTimes(4);
  });
});

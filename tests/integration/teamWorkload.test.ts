// Tests for GET /api/manager/team/workload — P2 N+1 fix
// Verifies that workload stats are computed in 2 batch queries (groupBy + findMany)
// rather than 4 per-member round-trips. Uses 10 members to confirm scale correctness.

const mockPrisma = {
  user: { findMany: jest.fn() },
  job: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _avg: { progress: null } }),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  jobLog: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
  jobDependency: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  jobStatusChange: { create: jest.fn().mockResolvedValue({}) },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockReturnValue(mockPrisma),
  JobStatus: {
    PENDING: 'PENDING', ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED',
    FAILED: 'FAILED', CANCELLED: 'CANCELLED',
  },
  JobType: {
    FILE_PROCESSING: 'FILE_PROCESSING', DATA_ANALYTICS: 'DATA_ANALYTICS',
    EMAIL_TASK: 'EMAIL_TASK', API_INTEGRATION: 'API_INTEGRATION', CUSTOM_SCRIPT: 'CUSTOM_SCRIPT',
  },
  JobPriority: { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' },
  LogLevel: { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' },
  UserRole: { USER: 'USER', MANAGER: 'MANAGER', ADMIN: 'ADMIN' },
}));

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

jest.mock('../../src/services/websocket', () => ({
  broadcastJobCreated: jest.fn(),
  broadcastJobStatusChange: jest.fn(),
  getConnectionStats: jest.fn().mockReturnValue({ totalConnections: 0 }),
  initializeWebSocket: jest.fn(),
}));

jest.mock('../../src/middleware/protectRoute', () => ({
  protectRoute: jest.fn(),
}));

import request from 'supertest';
import { app } from '../../src/app';
import { protectRoute } from '../../src/middleware/protectRoute';

const setManager = (userId = 'mgr-1') => {
  (protectRoute as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
    req.user = { id: userId, userId, fullName: 'Manager', email: 'mgr@test.com', profilePic: '', role: 'MANAGER' };
    next();
  });
};

const MEMBERS = Array.from({ length: 10 }, (_, i) => ({
  id: `user-${i + 1}`,
  fullName: `User ${i + 1}`,
  email: `user${i + 1}@test.com`,
}));

// user-1: 3 ACTIVE, 1 PENDING; user-2: 2 PENDING; rest: nothing
const COUNT_ROWS = [
  { userId: 'user-1', status: 'ACTIVE',   _count: { id: 3 } },
  { userId: 'user-1', status: 'PENDING',  _count: { id: 1 } },
  { userId: 'user-2', status: 'PENDING',  _count: { id: 2 } },
];

// user-1 completed two jobs: 1000 ms and 3000 ms → avg 2000 ms
const t0 = new Date('2024-01-01T00:00:00Z');
const COMPLETED_ROWS = [
  { userId: 'user-1', startedAt: new Date(t0.getTime()),        completedAt: new Date(t0.getTime() + 1000) },
  { userId: 'user-1', startedAt: new Date(t0.getTime() + 5000), completedAt: new Date(t0.getTime() + 8000) },
];

describe('GET /api/manager/team/workload — batched queries (P2)', () => {
  beforeEach(() => {
    setManager();
    mockPrisma.user.findMany.mockResolvedValue(MEMBERS);
    mockPrisma.job.groupBy.mockResolvedValue(COUNT_ROWS);
    mockPrisma.job.findMany.mockResolvedValue(COMPLETED_ROWS);
    mockPrisma.job.count.mockClear();
    mockPrisma.job.aggregate.mockClear();
  });

  it('returns 200 with workload for all 10 members', async () => {
    const res = await request(app).get('/api/manager/team/workload');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
  });

  it('does not call job.count or job.aggregate (no per-member queries)', async () => {
    await request(app).get('/api/manager/team/workload');
    expect(mockPrisma.job.count).not.toHaveBeenCalled();
    expect(mockPrisma.job.aggregate).not.toHaveBeenCalled();
  });

  it('calls groupBy once scoped to ACTIVE and PENDING statuses', async () => {
    await request(app).get('/api/manager/team/workload');
    expect(mockPrisma.job.groupBy).toHaveBeenCalledTimes(1);
    const call = mockPrisma.job.groupBy.mock.calls[0][0];
    expect(call.where.status.in).toEqual(expect.arrayContaining(['ACTIVE', 'PENDING']));
    expect(call.where.userId.in).toHaveLength(10);
  });

  it('calls job.findMany once for completed jobs across all members', async () => {
    await request(app).get('/api/manager/team/workload');
    // groupBy + findMany = 2 calls total on job
    expect(mockPrisma.job.findMany).toHaveBeenCalledTimes(1);
    const call = mockPrisma.job.findMany.mock.calls[0][0];
    expect(call.where.status).toBe('COMPLETED');
    expect(call.where.userId.in).toHaveLength(10);
  });

  it('computes correct activeJobs and queuedJobs for user-1', async () => {
    const res = await request(app).get('/api/manager/team/workload');
    // Sorted by totalLoad desc, user-1 (load=4) should be first
    const u1 = res.body.data[0];
    expect(u1.userId).toBe('user-1');
    expect(u1.activeJobs).toBe(3);
    expect(u1.queuedJobs).toBe(1);
    expect(u1.totalLoad).toBe(4);
  });

  it('computes correct avgCompletionTimeMs from completed job durations', async () => {
    const res = await request(app).get('/api/manager/team/workload');
    const u1 = res.body.data.find((m: any) => m.userId === 'user-1');
    // job1: 1000ms, job2: 3000ms → avg 2000ms
    expect(u1.avgCompletionTimeMs).toBe(2000);
  });

  it('returns zero avgCompletionTimeMs for members with no completed jobs', async () => {
    const res = await request(app).get('/api/manager/team/workload');
    const u3 = res.body.data.find((m: any) => m.userId === 'user-3');
    expect(u3.avgCompletionTimeMs).toBe(0);
  });

  it('sorts results by totalLoad descending', async () => {
    const res = await request(app).get('/api/manager/team/workload');
    const loads = res.body.data.map((m: any) => m.totalLoad);
    for (let i = 0; i < loads.length - 1; i++) {
      expect(loads[i]).toBeGreaterThanOrEqual(loads[i + 1]);
    }
  });
});

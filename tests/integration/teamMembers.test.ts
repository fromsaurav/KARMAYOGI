// Tests for GET /api/manager/team/members — P1 N+1 fix
// Verifies that job stats are computed correctly via a single groupBy query
// rather than 4 × job.count per member. Uses 12 simulated team members to
// ensure the batched path handles scale correctly.

const mockPrisma = {
  user: { findMany: jest.fn() },
  job: {
    groupBy: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
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
    PENDING: 'PENDING',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
  JobType: {
    FILE_PROCESSING: 'FILE_PROCESSING',
    DATA_ANALYTICS: 'DATA_ANALYTICS',
    EMAIL_TASK: 'EMAIL_TASK',
    API_INTEGRATION: 'API_INTEGRATION',
    CUSTOM_SCRIPT: 'CUSTOM_SCRIPT',
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

// Build 12 fake team members
const makeMember = (i: number) => ({
  id: `user-${i}`,
  fullName: `User ${i}`,
  email: `user${i}@test.com`,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  jobs: [],
});

const MEMBERS = Array.from({ length: 12 }, (_, i) => makeMember(i + 1));

// groupBy rows: user-1 has 3 COMPLETED + 1 FAILED, user-2 has 2 PENDING, rest have nothing
const GROUP_BY_ROWS = [
  { userId: 'user-1', status: 'COMPLETED', _count: { id: 3 } },
  { userId: 'user-1', status: 'FAILED',    _count: { id: 1 } },
  { userId: 'user-2', status: 'PENDING',   _count: { id: 2 } },
];

describe('GET /api/manager/team/members — batched groupBy (P1)', () => {
  beforeEach(() => {
    setManager();
    mockPrisma.user.findMany.mockResolvedValue(MEMBERS);
    mockPrisma.job.groupBy.mockResolvedValue(GROUP_BY_ROWS);
    mockPrisma.job.count.mockResolvedValue(0); // should NOT be called
  });

  it('returns 200 with stats for all 12 members', async () => {
    const res = await request(app).get('/api/manager/team/members');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(12);
  });

  it('does not call job.count at all (no per-member queries)', async () => {
    await request(app).get('/api/manager/team/members');
    expect(mockPrisma.job.count).not.toHaveBeenCalled();
  });

  it('calls groupBy exactly once for all members', async () => {
    await request(app).get('/api/manager/team/members');
    expect(mockPrisma.job.groupBy).toHaveBeenCalledTimes(1);
    const call = mockPrisma.job.groupBy.mock.calls[0][0];
    expect(call.by).toEqual(['userId', 'status']);
    expect(call.where.userId.in).toHaveLength(12);
  });

  it('correctly sums totalJobs for a member with multiple status rows', async () => {
    const res = await request(app).get('/api/manager/team/members');
    const member1 = res.body.data.find((m: any) => m.id === 'user-1');
    // 3 COMPLETED + 1 FAILED = 4 total
    expect(member1.stats.totalJobs).toBe(4);
    expect(member1.stats.completedJobs).toBe(3);
    expect(member1.stats.failedJobs).toBe(1);
    expect(member1.stats.activeJobs).toBe(0);
  });

  it('counts PENDING jobs as activeJobs', async () => {
    const res = await request(app).get('/api/manager/team/members');
    const member2 = res.body.data.find((m: any) => m.id === 'user-2');
    expect(member2.stats.activeJobs).toBe(2);
    expect(member2.stats.totalJobs).toBe(2);
  });

  it('returns zero stats for members with no jobs', async () => {
    const res = await request(app).get('/api/manager/team/members');
    const member5 = res.body.data.find((m: any) => m.id === 'user-5');
    expect(member5.stats).toEqual({ totalJobs: 0, activeJobs: 0, completedJobs: 0, failedJobs: 0 });
  });
});

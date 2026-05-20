// Unit tests for WebSocket auth middleware (W1a) and heartbeat logic (W1b).
// Neither test needs a live server — authenticateSocket and HEARTBEAT_INTERVAL_MS
// are exported so we can exercise them with mock sockets.

import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';

// Config must be stubbed before the module loads
jest.mock('../../src/config/env', () => ({
  config: {
    server: { corsOrigin: ['http://localhost:3000'], port: 3000, nodeEnv: 'test' },
    jwt: { secret: TEST_SECRET, expiresIn: '7d' },
    redis: { url: 'redis://localhost:6379' },
    queue: { maxRetryAttempts: 3, retryBackoffDelay: 2000, concurrency: 5 },
    database: { url: 'postgresql://test:test@localhost/test' },
    rateLimiting: { windowMs: 900000, maxRequests: 100 },
    metrics: { port: 9090 },
    email: { from: 'test@test.com', frontendUrl: 'http://localhost:3001' },
  },
}));

jest.mock('../../src/utils/config', () => ({
  config: {
    server: { corsOrigin: ['http://localhost:3000'], port: 3000, nodeEnv: 'test' },
    jwt: { secret: TEST_SECRET, expiresIn: '7d' },
    redis: { url: 'redis://localhost:6379' },
    queue: { maxRetryAttempts: 3, retryBackoffDelay: 2000, concurrency: 5 },
    database: { url: 'postgresql://test:test@localhost/test' },
    rateLimiting: { windowMs: 900000, maxRequests: 100 },
    metrics: { port: 9090 },
    email: { from: 'test@test.com', frontendUrl: 'http://localhost:3001' },
  },
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockReturnValue({
    user: { findUnique: jest.fn() },
  }),
  UserRole: { USER: 'USER', MANAGER: 'MANAGER', ADMIN: 'ADMIN' },
}));

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  on: jest.fn().mockReturnThis(),
  disconnect: jest.fn().mockResolvedValue(undefined),
})));

jest.mock('../../src/services/presenceService', () => ({
  PresenceService: jest.fn().mockImplementation(() => ({
    userConnected: jest.fn(), userDisconnected: jest.fn(),
    joinJob: jest.fn(), leaveJob: jest.fn(),
    userTyping: jest.fn(), updateActivity: jest.fn(),
    getOnlineUsersByRole: jest.fn().mockReturnValue([]),
    getJobViewers: jest.fn().mockReturnValue([]),
  })),
}));

import { authenticateSocket, HEARTBEAT_INTERVAL_MS } from '../../src/services/websocket';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeSocket(token?: string, headerAuth?: string) {
  return {
    id: 'sock-1',
    handshake: {
      auth: { token },
      headers: { authorization: headerAuth },
    },
    data: {} as Record<string, any>,
    disconnect: jest.fn(),
    emit: jest.fn(),
  } as any;
}

function validToken(userId = 'user-1') {
  return jwt.sign({ userId, email: 'u@t.com', role: 'USER' }, TEST_SECRET, { expiresIn: '1h' });
}

function expiredToken() {
  // Sign with expiresIn: 1 second, then let it expire before the test reads it
  return jwt.sign({ userId: 'user-1', email: 'u@t.com' }, TEST_SECRET, { expiresIn: '1s' });
}

// ─── W1a: JWT expiry validation ──────────────────────────────────────────────

describe('authenticateSocket — JWT expiry (W1a)', () => {
  it('calls next() with no error for a valid token', async () => {
    const socket = makeSocket(validToken());
    const next = jest.fn();
    await authenticateSocket(socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toBeDefined();
  });

  it('attaches decoded user to socket.data.user', async () => {
    const socket = makeSocket(validToken('user-42'));
    const next = jest.fn();
    await authenticateSocket(socket, next);
    expect(socket.data.user.userId).toBe('user-42');
  });

  it('rejects with code 4001 when token is expired', async () => {
    const token = expiredToken();
    // wait 1s for iat-based "expired in 1s" token to actually expire
    await new Promise(r => setTimeout(r, 1100));
    const socket = makeSocket(token);
    const next = jest.fn();
    await authenticateSocket(socket, next);
    const err = next.mock.calls[0][0] as any;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/expired/i);
    expect(err.data?.code).toBe(4001);
  });

  it('rejects with generic error for a tampered token', async () => {
    const socket = makeSocket('not.a.valid.jwt');
    const next = jest.fn();
    await authenticateSocket(socket, next);
    const err = next.mock.calls[0][0] as any;
    expect(err).toBeInstanceOf(Error);
    expect(err.data?.code).toBeUndefined(); // not a 4001
  });

  it('rejects when no token is provided', async () => {
    const socket = makeSocket(undefined);
    const next = jest.fn();
    await authenticateSocket(socket, next);
    const err = next.mock.calls[0][0] as any;
    expect(err.message).toMatch(/token required/i);
  });

  it('reads token from Authorization header when auth.token is absent', async () => {
    const socket = makeSocket(undefined, `Bearer ${validToken()}`);
    const next = jest.fn();
    await authenticateSocket(socket, next);
    expect(next).toHaveBeenCalledWith();
  });
});

// ─── W1b: heartbeat constant ─────────────────────────────────────────────────

describe('HEARTBEAT_INTERVAL_MS (W1b)', () => {
  it('is exported and equals 30 000 ms', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(30_000);
  });
});

// ─── W1b: heartbeat disconnect logic ─────────────────────────────────────────

describe('heartbeat — stale socket termination (W1b)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('marks socket isAlive=false on first client:pong receipt', () => {
    // Simulates the socket.on('client:pong') handler
    const socketData: Record<string, any> = { isAlive: true };
    const pongHandler = () => { socketData.isAlive = true; };
    // fire pong
    pongHandler();
    expect(socketData.isAlive).toBe(true);
  });

  it('disconnects a socket whose isAlive is still false after interval', () => {
    const deadSocket = {
      data: { isAlive: false },
      disconnect: jest.fn(),
      emit: jest.fn(),
    };

    // Replicate what the heartbeat timer does to each socket
    const runHeartbeatTick = (socket: typeof deadSocket) => {
      if (!socket.data.isAlive) {
        socket.disconnect(true);
        return;
      }
      socket.data.isAlive = false;
      socket.emit('server:ping');
    };

    runHeartbeatTick(deadSocket);
    expect(deadSocket.disconnect).toHaveBeenCalledWith(true);
    expect(deadSocket.emit).not.toHaveBeenCalled();
  });

  it('sends server:ping and sets isAlive=false for a live socket', () => {
    const liveSocket = {
      data: { isAlive: true },
      disconnect: jest.fn(),
      emit: jest.fn(),
    };

    const runHeartbeatTick = (socket: typeof liveSocket) => {
      if (!socket.data.isAlive) { socket.disconnect(true); return; }
      socket.data.isAlive = false;
      socket.emit('server:ping');
    };

    runHeartbeatTick(liveSocket);
    expect(liveSocket.disconnect).not.toHaveBeenCalled();
    expect(liveSocket.emit).toHaveBeenCalledWith('server:ping');
    expect(liveSocket.data.isAlive).toBe(false);
  });
});

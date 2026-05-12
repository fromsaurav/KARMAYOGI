// Set required env vars before any module loads (called via setupFiles in jest.config.ts)
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/karmayogi_test';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

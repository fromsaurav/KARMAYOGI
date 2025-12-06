import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate critical environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REDIS_URL'
];

// Optional environment variables with warnings
const optionalEnvVars = [
  'SENDGRID_API_KEY',
  'EMAIL_FROM',
  'FRONTEND_URL'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(envVar => {
    console.error(`   - ${envVar}`);
  });
  process.exit(1);
}

// Check optional environment variables and log warnings
const missingOptionalEnvVars = optionalEnvVars.filter(envVar => !process.env[envVar]);
if (missingOptionalEnvVars.length > 0) {
  console.warn('⚠️  Missing optional environment variables (some features may be disabled):');
  missingOptionalEnvVars.forEach(envVar => {
    console.warn(`   - ${envVar}`);
  });
}

// Validate JWT_SECRET length
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.WEBSOCKET_CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001']
  },
  database: {
    url: process.env.DATABASE_URL!
  },
  redis: {
    url: process.env.REDIS_URL!
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string
  },
  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    from: process.env.EMAIL_FROM || 'noreply@karmayogi.dev',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001'
  },
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
    retryBackoffDelay: parseInt(process.env.RETRY_BACKOFF_DELAY || '2000')
  },
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
  },
  metrics: {
    port: parseInt(process.env.METRICS_PORT || '9090')
  },
};
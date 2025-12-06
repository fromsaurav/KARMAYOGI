// Main Express application setup with middleware configuration
// Configures security, logging, CORS, and routing for the Karmayogi task queue system

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { globalRateLimit } from './middleware/rateLimiter';
import { auditLog } from './middleware/auditLog';
import authRoutes from './routes/authRoutes';
import jobRoutes from './routes/jobs';
import analyticsRoutes from './routes/analytics';
import healthRoutes from './routes/health';
import dashboardRoutes from './routes/dashboard';
import adminRoutes from './routes/admin';
import templateRoutes from './routes/templates';
import managerRoutes from './routes/manager';
import collaborationRoutes from './routes/collaboration';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false
}));

// CORS with caching
app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // Cache preflight for 24 hours
}));

// Compression middleware for response optimization
app.use(compression({
  filter: (req: express.Request, res: express.Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Balance between compression speed and ratio
}));

// Optimized logging - only in production
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', {
    skip: (_req: express.Request, res: express.Response) => res.statusCode < 400, // Only log errors
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      }
    }
  }));
} else {
  app.use(morgan('dev'));
}

// Body parsers with optimized limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Passport removed - using simple JWT auth

app.use(globalRateLimit);
app.use(auditLog); // Audit all API requests for compliance

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/collaboration', collaborationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
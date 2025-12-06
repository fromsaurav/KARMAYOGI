import express from 'express';
import client from 'prom-client';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { getQueueStats } from '../queues/queueManager';
import { getJobStats } from '../services/jobService';
import { getConnectionStats } from './websocket';

// Create a Registry to register the metrics
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({
  register,
  prefix: 'karmayogi_',
});

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'karmayogi_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const httpRequestsTotal = new client.Counter({
  name: 'karmayogi_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const activeConnections = new client.Gauge({
  name: 'karmayogi_active_connections',
  help: 'Number of active WebSocket connections',
});

const jobsTotal = new client.Counter({
  name: 'karmayogi_jobs_total',
  help: 'Total number of jobs created',
  labelNames: ['type', 'priority', 'user_role'],
});

const jobsProcessed = new client.Counter({
  name: 'karmayogi_jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['type', 'status'],
});

const jobProcessingDuration = new client.Histogram({
  name: 'karmayogi_job_processing_duration_seconds',
  help: 'Time taken to process jobs',
  labelNames: ['type', 'status'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1200],
});

const queueSize = new client.Gauge({
  name: 'karmayogi_queue_size',
  help: 'Current number of jobs in queue',
  labelNames: ['queue', 'status'],
});

const workerHealth = new client.Gauge({
  name: 'karmayogi_worker_health',
  help: 'Worker health status (1 = healthy, 0 = unhealthy)',
  labelNames: ['worker_id'],
});

const redisConnections = new client.Gauge({
  name: 'karmayogi_redis_connections',
  help: 'Number of Redis connections',
});

const rateLimitHits = new client.Counter({
  name: 'karmayogi_rate_limit_hits_total',
  help: 'Number of rate limit violations',
  labelNames: ['type', 'identifier'],
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(activeConnections);
register.registerMetric(jobsTotal);
register.registerMetric(jobsProcessed);
register.registerMetric(jobProcessingDuration);
register.registerMetric(queueSize);
register.registerMetric(workerHealth);
register.registerMetric(redisConnections);
register.registerMetric(rateLimitHits);

// Middleware to collect HTTP metrics
export const httpMetricsMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();

    httpRequestDuration
      .labels(method, route, statusCode)
      .observe(duration);

    httpRequestsTotal
      .labels(method, route, statusCode)
      .inc();
  });

  next();
};

// Job metrics functions
export function recordJobCreated(type: string, priority: string, userRole: string): void {
  jobsTotal.labels(type, priority, userRole).inc();
}

export function recordJobProcessed(type: string, status: string, duration?: number): void {
  jobsProcessed.labels(type, status).inc();
  
  if (duration) {
    jobProcessingDuration.labels(type, status).observe(duration / 1000);
  }
}

export function recordRateLimitHit(type: 'ip' | 'user', identifier: string): void {
  rateLimitHits.labels(type, identifier).inc();
}

export function updateWorkerHealth(workerId: string, isHealthy: boolean): void {
  workerHealth.labels(workerId).set(isHealthy ? 1 : 0);
}

export function updateRedisConnections(count: number): void {
  redisConnections.set(count);
}

// Periodic metrics collection
let metricsInterval: NodeJS.Timeout;

async function collectQueueMetrics(): Promise<void> {
  try {
    const stats = await getQueueStats();
    
    Object.entries(stats).forEach(([queueName, queueStats]: [string, any]) => {
      queueSize.labels(queueName, 'waiting').set(queueStats.waiting);
      queueSize.labels(queueName, 'active').set(queueStats.active);
      queueSize.labels(queueName, 'completed').set(queueStats.completed);
      queueSize.labels(queueName, 'failed').set(queueStats.failed);
      queueSize.labels(queueName, 'delayed').set(queueStats.delayed);
    });
  } catch (error) {
    // Silently handle Redis auth errors in metrics collection
    if (error instanceof Error && error.message.includes('NOAUTH')) {
      return; // Skip metrics collection when Redis auth fails
    }
    logger.warn('Queue metrics collection skipped:', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function collectConnectionMetrics(): Promise<void> {
  try {
    const stats = getConnectionStats();
    if (stats) {
      activeConnections.set(stats.totalConnections);
    }
  } catch (error) {
    logger.error('Failed to collect connection metrics:', error);
  }
}

export function startMetricsCollection(): void {
  // Collect metrics every 30 seconds
  metricsInterval = setInterval(async () => {
    await collectQueueMetrics();
    await collectConnectionMetrics();
  }, 30000);

  logger.info('Metrics collection started');
}

export function stopMetricsCollection(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    logger.info('Metrics collection stopped');
  }
}

// Metrics server
export async function startMetricsServer(): Promise<void> {
  const app = express();

  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error('Error generating metrics:', error);
      res.status(500).end('Error generating metrics');
    }
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'metrics'
    });
  });

  return new Promise((resolve) => {
    app.listen(config.metrics.port, () => {
      logger.info(`Metrics server started on port ${config.metrics.port}`);
      startMetricsCollection();
      resolve();
    });
  });
}

// Dashboard metrics endpoint
export async function getDashboardMetrics(): Promise<any> {
  try {
    const queueStats = await getQueueStats();
    const jobStats = await getJobStats();
    const connectionStats = getConnectionStats();

    return {
      queues: queueStats,
      jobs: jobStats,
      connections: connectionStats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get dashboard metrics:', error);
    throw error;
  }
}

export { register };
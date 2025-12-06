import { app } from './app';
import { config } from './utils/config';
import { logger } from './utils/logger';
// import { initializeQueues } from './queues/queueManager';  // Disabled for auth testing
// import { startWorkers } from './workers/workerManager';  // Disabled for auth testing
import { initializeWebSocket } from './services/websocket';
import { initializeWorkerTracker, getWorkerTracker } from './services/workerTracker';
import { initializeAlertSystem, getAlertSystem } from './services/alertSystem';
import { initializeRedisCache } from './middleware/cacheMiddleware';
import { createServer } from 'http';
// import { startMetricsServer } from './services/metrics';  // Disabled for auth testing

async function startServer() {
  try {
    logger.info('Starting KarmaYogi server...');

    // Initialize Redis cache (optional - server continues if Redis is unavailable)
    await initializeRedisCache();

    // Create HTTP server
    const server = createServer(app);

    // Initialize WebSocket server
    initializeWebSocket(server);
    logger.info('✅ WebSocket server initialized');

    // Initialize Worker Tracker
    const workerTracker = initializeWorkerTracker();
    app.set('workerTracker', workerTracker);
    logger.info('✅ Worker tracker initialized');

    // Initialize Alert System
    const alertSystem = initializeAlertSystem({
      queueDepth: { warning: 50, critical: 100 },
      failureRate: { warning: 10, critical: 25 },
      workerHealth: { minHealthyWorkers: 1, maxResponseTime: 30000 },
      performance: { maxAvgProcessingTime: 300000 }
    });
    app.set('alertSystem', alertSystem);
    logger.info('✅ Alert system initialized and monitoring');

    // Start main server
    server.listen(config.server.port, () => {
      logger.info(`🚀 KarmaYogi Server running on port ${config.server.port} in ${config.server.nodeEnv} mode`);
      logger.info(`🔐 Auth endpoints available at http://localhost:${config.server.port}/api/auth`);
      logger.info(`🔌 WebSocket server ready for real-time updates`);
      logger.info(`👷 Worker pool monitoring active`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT. Graceful shutdown...');
      const tracker = getWorkerTracker();
      if (tracker) {
        tracker.cleanup();
      }
      const alerts = getAlertSystem();
      if (alerts) {
        alerts.cleanup();
      }
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM. Graceful shutdown...');
      const tracker = getWorkerTracker();
      if (tracker) {
        tracker.cleanup();
      }
      const alerts = getAlertSystem();
      if (alerts) {
        alerts.cleanup();
      }
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
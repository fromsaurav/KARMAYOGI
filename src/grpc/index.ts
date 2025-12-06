/**
 * gRPC Clients for Go Microservices
 *
 * This module provides typed clients for communicating with Go services:
 * - WorkerClient: Job processing and worker pool management
 * - ExecutorClient: Specific job type execution (files, emails, APIs, scripts)
 */

export { workerClient } from './workerClient';
export { executorClient } from './executorClient';

// Graceful shutdown
process.on('SIGTERM', () => {
  const { workerClient } = require('./workerClient');
  const { executorClient } = require('./executorClient');

  workerClient.close();
  executorClient.close();
  process.exit(0);
});

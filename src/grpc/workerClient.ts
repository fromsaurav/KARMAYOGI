import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { logger } from '../utils/logger';

// Load proto file
const PROTO_PATH = path.join(__dirname, '../../go-services/shared/proto/worker.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const workerProto = grpc.loadPackageDefinition(packageDefinition).worker as any;

// gRPC Client Configuration
const WORKER_SERVICE_URL = process.env.WORKER_SERVICE_URL || 'localhost:50051';

class WorkerClient {
  private client: any;

  constructor() {
    this.client = new workerProto.WorkerService(
      WORKER_SERVICE_URL,
      grpc.credentials.createInsecure()
    );
    logger.info(`gRPC Worker Client connected to ${WORKER_SERVICE_URL}`);
  }

  /**
   * Process a job using Go worker service
   */
  async processJob(jobData: {
    jobId: string;
    jobType: string;
    payload: any;
    priority?: number;
    timeout?: number;
    userId: string;
    metadata?: Record<string, string>;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = {
        job_id: jobData.jobId,
        job_type: jobData.jobType,
        payload: JSON.stringify(jobData.payload),
        priority: jobData.priority || 1,
        timeout: jobData.timeout || 300,
        user_id: jobData.userId,
        metadata: jobData.metadata || {},
      };

      this.client.ProcessJob(request, (error: any, response: any) => {
        if (error) {
          logger.error('gRPC ProcessJob error:', error);
          reject(error);
        } else {
          resolve({
            jobId: response.job_id,
            status: response.status,
            result: response.result ? JSON.parse(response.result) : null,
            error: response.error,
            startedAt: response.started_at,
            completedAt: response.completed_at,
            durationMs: response.duration_ms,
          });
        }
      });
    });
  }

  /**
   * Get worker pool status
   */
  async getWorkerStatus(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetWorkerStatus({}, (error: any, response: any) => {
        if (error) {
          logger.error('gRPC GetWorkerStatus error:', error);
          reject(error);
        } else {
          resolve({
            activeWorkers: response.active_workers,
            idleWorkers: response.idle_workers,
            queueSize: response.queue_size,
            jobsProcessed: response.jobs_processed,
            jobsFailed: response.jobs_failed,
            cpuUsage: response.cpu_usage,
            memoryUsage: response.memory_usage,
            workers: response.workers || [],
          });
        }
      });
    });
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string, reason: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = {
        job_id: jobId,
        reason: reason || 'Cancelled by user',
      };

      this.client.CancelJob(request, (error: any, response: any) => {
        if (error) {
          logger.error('gRPC CancelJob error:', error);
          reject(error);
        } else {
          resolve({
            success: response.success,
            message: response.message,
          });
        }
      });
    });
  }

  /**
   * Stream job updates in real-time
   */
  streamJobUpdates(jobId: string, onUpdate: (update: any) => void, onError?: (error: any) => void) {
    const request = {
      job_id: jobId,
    };

    const stream = this.client.StreamJobUpdates(request);

    stream.on('data', (update: any) => {
      onUpdate({
        jobId: update.job_id,
        status: update.status,
        progress: update.progress,
        message: update.message,
        timestamp: update.timestamp,
      });
    });

    stream.on('error', (error: any) => {
      logger.error('gRPC StreamJobUpdates error:', error);
      if (onError) onError(error);
    });

    stream.on('end', () => {
      logger.info(`Job ${jobId} stream ended`);
    });

    return stream;
  }

  /**
   * Close the gRPC connection
   */
  close() {
    grpc.closeClient(this.client);
    logger.info('gRPC Worker Client closed');
  }
}

// Export singleton instance
export const workerClient = new WorkerClient();

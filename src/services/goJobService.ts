/**
 * Go Job Service - Integration with Go microservices via gRPC
 *
 * This service provides a high-level interface for submitting jobs
 * to the Go worker pool for high-performance processing.
 */

import { workerClient, executorClient } from '../grpc';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface GoJobRequest {
  jobId: string;
  jobType: string;
  payload: any;
  userId: string;
  priority?: number;
  timeout?: number;
  metadata?: Record<string, string>;
}

/**
 * Submit a job to the Go worker service
 */
export async function submitJobToGoWorker(request: GoJobRequest): Promise<any> {
  try {
    logger.info(`Submitting job ${request.jobId} to Go worker service`);

    // Submit to Go worker via gRPC
    const response = await workerClient.processJob({
      jobId: request.jobId,
      jobType: request.jobType,
      payload: request.payload,
      userId: request.userId,
      priority: request.priority || 1,
      timeout: request.timeout || 300,
      metadata: request.metadata || {},
    });

    logger.info(`Job ${request.jobId} queued in Go worker pool: ${response.status}`);
    return response;
  } catch (error) {
    logger.error(`Failed to submit job ${request.jobId} to Go worker:`, error);
    throw error;
  }
}

/**
 * Process file using Go executor
 */
export async function processFileWithGo(
  jobId: string,
  filePath: string,
  fileType: string,
  operation: string
): Promise<any> {
  try {
    const response = await executorClient.processFile({
      jobId,
      filePath,
      fileType,
      operation,
    });

    // Update job in database
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: response.success ? 'completed' : 'failed',
        result: response,
        error: response.error,
        completedAt: new Date(),
      },
    });

    return response;
  } catch (error) {
    logger.error(`File processing failed for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Send email using Go executor
 */
export async function sendEmailWithGo(
  jobId: string,
  recipients: string[],
  subject: string,
  body: string,
  htmlBody?: string
): Promise<any> {
  try {
    const response = await executorClient.sendEmail({
      jobId,
      recipients,
      subject,
      body,
      htmlBody,
    });

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: response.success ? 'completed' : 'failed',
        result: response,
        error: response.error,
        completedAt: new Date(),
      },
    });

    return response;
  } catch (error) {
    logger.error(`Email sending failed for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Call API using Go executor
 */
export async function callAPIWithGo(
  jobId: string,
  url: string,
  method: string,
  headers?: Record<string, string>,
  body?: string
): Promise<any> {
  try {
    const response = await executorClient.callAPI({
      jobId,
      url,
      method,
      headers,
      body,
      timeout: 30,
      retries: 3,
    });

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: response.success ? 'completed' : 'failed',
        result: response,
        error: response.error,
        completedAt: new Date(),
      },
    });

    return response;
  } catch (error) {
    logger.error(`API call failed for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Run custom script using Go executor
 */
export async function runScriptWithGo(
  jobId: string,
  scriptType: string,
  scriptContent: string,
  args?: string[],
  env?: Record<string, string>
): Promise<any> {
  try {
    const response = await executorClient.runScript({
      jobId,
      scriptType,
      scriptContent,
      args,
      env,
      timeout: 300,
    });

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: response.success ? 'completed' : 'failed',
        result: response,
        error: response.error,
        completedAt: new Date(),
      },
    });

    return response;
  } catch (error) {
    logger.error(`Script execution failed for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Analyze data using Go executor
 */
export async function analyzeDataWithGo(
  jobId: string,
  dataSource: string,
  query: string,
  aggregations?: string[]
): Promise<any> {
  try {
    const response = await executorClient.analyzeData({
      jobId,
      dataSource,
      query,
      aggregations,
    });

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: response.success ? 'completed' : 'failed',
        result: response,
        error: response.error,
        completedAt: new Date(),
      },
    });

    return response;
  } catch (error) {
    logger.error(`Data analysis failed for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Get worker pool status
 */
export async function getWorkerPoolStatus(): Promise<any> {
  try {
    const status = await workerClient.getWorkerStatus();
    return status;
  } catch (error) {
    logger.error('Failed to get worker status:', error);
    throw error;
  }
}

/**
 * Cancel a job in the worker pool
 */
export async function cancelJobInWorkerPool(jobId: string, reason: string): Promise<any> {
  try {
    const response = await workerClient.cancelJob(jobId, reason);

    if (response.success) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'cancelled',
          error: reason,
          completedAt: new Date(),
        },
      });
    }

    return response;
  } catch (error) {
    logger.error(`Failed to cancel job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Stream job updates in real-time
 */
export function streamJobUpdates(
  jobId: string,
  onUpdate: (update: any) => void,
  onError?: (error: any) => void
) {
  return workerClient.streamJobUpdates(jobId, onUpdate, onError);
}

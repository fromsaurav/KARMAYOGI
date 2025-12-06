import { queues } from '../queues/queueManager';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { JobData, JobType, JobStatus, LogLevel } from '../types';
import { processFileProcessingJob } from './processors/fileProcessor';
import { processDataAnalyticsJob } from './processors/dataAnalyticsProcessor';
import { processEmailTaskJob } from './processors/emailProcessor';
import { processApiIntegrationJob } from './processors/apiProcessor';
import { processCustomScriptJob } from './processors/customScriptProcessor';
import { updateJobProgress, logJobEvent } from '../services/jobService';
import Bull from 'bull';

const jobProcessors = {
  [JobType.FILE_PROCESSING]: processFileProcessingJob,
  [JobType.DATA_ANALYTICS]: processDataAnalyticsJob,
  [JobType.EMAIL_TASK]: processEmailTaskJob,
  [JobType.API_INTEGRATION]: processApiIntegrationJob,
  [JobType.CUSTOM_SCRIPT]: processCustomScriptJob
};

export async function startWorkers(): Promise<void> {
  try {
    for (const [queueName, queue] of queues) {
      if (queueName === 'dead-letter') continue;

      const concurrency = getConcurrencyForQueue(queueName);
      
      queue.process('*', concurrency, async (job: Bull.Job<JobData>) => {
        return await processJob(job);
      });

      logger.info(`Workers started for queue ${queueName} with concurrency ${concurrency}`);
    }
  } catch (error) {
    logger.error('Failed to start workers:', error);
    throw error;
  }
}

async function processJob(job: Bull.Job<JobData>): Promise<any> {
  const { data } = job;
  const startTime = Date.now();
  const jobId = String(job.id);
  
  try {
    logger.info(`Processing job ${jobId}`, {
      jobId,
      type: data.type,
      userId: data.userId,
      attempt: job.attemptsMade + 1
    });

    await logJobEvent(jobId, LogLevel.INFO, `Job processing started (attempt ${job.attemptsMade + 1})`);
    await updateJobProgress(jobId, JobStatus.ACTIVE, 0);

    // Get the appropriate processor
    const processor = jobProcessors[data.type as keyof typeof jobProcessors];
    if (!processor) {
      throw new Error(`No processor found for job type: ${data.type}`);
    }

    // Progress callback
    const progressCallback = async (progress: number, message?: string) => {
      await job.progress(progress);
      await updateJobProgress(jobId, JobStatus.ACTIVE, progress);
      if (message) {
        await logJobEvent(jobId, LogLevel.INFO, message);
      }
    };

    // Process the job
    const result = await processor(data, progressCallback);

    const processingTime = Date.now() - startTime;
    logger.info(`Job ${jobId} completed successfully`, {
      jobId,
      type: data.type,
      processingTime,
      result
    });

    await updateJobProgress(jobId, JobStatus.COMPLETED, 100, result);
    await logJobEvent(jobId, LogLevel.INFO, `Job completed successfully in ${processingTime}ms`);

    return result;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error(`Job ${jobId} failed`, {
      jobId,
      type: data.type,
      attempt: job.attemptsMade + 1,
      error: errorMessage,
      processingTime
    });

    await logJobEvent(jobId, LogLevel.ERROR, `Job failed: ${errorMessage}`);

    // Check if this is the final attempt
    if (job.attemptsMade + 1 >= (data.maxRetries || config.queue.maxRetryAttempts)) {
      await updateJobProgress(jobId, JobStatus.FAILED, job.progress(), null, errorMessage);
      await logJobEvent(jobId, LogLevel.ERROR, 'Job failed after maximum retry attempts');
      
      // Move to dead letter queue
      await moveToDeadLetterQueue(job, error instanceof Error ? error : new Error(errorMessage));
    } else {
      await updateJobProgress(jobId, JobStatus.PENDING, job.progress(), null, errorMessage);
      await logJobEvent(jobId, LogLevel.WARN, `Job will retry in ${getRetryDelay(job.attemptsMade)}ms`);
    }

    throw error;
  }
}

function getConcurrencyForQueue(queueName: string): number {
  const concurrencyMap: { [key: string]: number } = {
    'high-priority': 3,
    'medium-priority': 5,
    'low-priority': 8
  };
  return concurrencyMap[queueName] || config.queue.concurrency;
}

function getRetryDelay(attempt: number): number {
  return Math.min(config.queue.retryBackoffDelay * Math.pow(2, attempt), 300000);
}

async function moveToDeadLetterQueue(job: Bull.Job<JobData>, error: Error): Promise<void> {
  try {
    const deadLetterQueue = queues.get('dead-letter');
    if (deadLetterQueue) {
      await deadLetterQueue.add('failed-job', {
        originalJob: job.data,
        jobId: job.id,
        error: error.message,
        attempts: job.attemptsMade + 1,
        failedAt: new Date(),
        queue: job.queue.name
      });
      
      logger.info(`Job ${String(job.id)} moved to dead letter queue`);
    }
  } catch (dlqError) {
    logger.error(`Failed to move job ${String(job.id)} to dead letter queue:`, dlqError);
  }
}

export async function stopWorkers(): Promise<void> {
  try {
    for (const [queueName, queue] of queues) {
      await queue.close();
      logger.info(`Workers stopped for queue ${queueName}`);
    }
  } catch (error) {
    logger.error('Error stopping workers:', error);
    throw error;
  }
}
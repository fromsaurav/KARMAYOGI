import Bull from 'bull';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { JobData, JobPriority } from '../types';

interface QueueConfig {
  name: string;
  concurrency: number;
  priority: number;
}

const queueConfigs: QueueConfig[] = [
  { name: 'high-priority', concurrency: 3, priority: 1 },
  { name: 'medium-priority', concurrency: 5, priority: 2 },
  { name: 'low-priority', concurrency: 8, priority: 3 }
];

export const queues: Map<string, Bull.Queue> = new Map();

export async function initializeQueues(): Promise<void> {
  try {
    for (const queueConfig of queueConfigs) {
      const queue = new Bull(queueConfig.name, {
        redis: config.redis.url,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: config.queue.maxRetryAttempts,
          backoff: {
            type: 'exponential',
            delay: config.queue.retryBackoffDelay,
          },
        },
        settings: {
          stalledInterval: 30 * 1000,
          maxStalledCount: 3,
        }
      });

      // Queue event handlers
      queue.on('completed', (job, result) => {
        logger.info(`Job ${job.id} completed in queue ${queueConfig.name}`, {
          jobId: job.id,
          queue: queueConfig.name,
          result
        });
      });

      queue.on('failed', (job, error) => {
        logger.error(`Job ${job.id} failed in queue ${queueConfig.name}`, {
          jobId: job.id,
          queue: queueConfig.name,
          error: error.message,
          stack: error.stack
        });
      });

      queue.on('stalled', (job) => {
        logger.warn(`Job ${job.id} stalled in queue ${queueConfig.name}`, {
          jobId: job.id,
          queue: queueConfig.name
        });
      });

      queue.on('active', (job) => {
        logger.info(`Job ${job.id} started processing in queue ${queueConfig.name}`, {
          jobId: job.id,
          queue: queueConfig.name
        });
      });

      queues.set(queueConfig.name, queue);
      logger.info(`Queue ${queueConfig.name} initialized with concurrency ${queueConfig.concurrency}`);
    }

    // Create dead letter queue for failed jobs — same Redis as all other queues
    const deadLetterQueue = new Bull('dead-letter', {
      redis: config.redis.url,
    });

    queues.set('dead-letter', deadLetterQueue);
    logger.info('Dead letter queue initialized');

  } catch (error) {
    logger.error('Failed to initialize queues:', error);
    throw error;
  }
}

export function getQueueByPriority(priority: JobPriority): Bull.Queue {
  const queueMap = {
    [JobPriority.HIGH]: 'high-priority',
    [JobPriority.MEDIUM]: 'medium-priority',
    [JobPriority.LOW]: 'low-priority'
  };

  const queueName = queueMap[priority];
  const queue = queues.get(queueName);
  
  if (!queue) {
    throw new Error(`Queue not found for priority: ${priority}`);
  }
  
  return queue;
}

export async function addJob(jobData: JobData): Promise<Bull.Job> {
  try {
    const queue = getQueueByPriority(jobData.priority);
    
    const jobOptions: Bull.JobOptions = {
      delay: jobData.delay,
      attempts: jobData.maxRetries || config.queue.maxRetryAttempts,
      removeOnComplete: true,
      removeOnFail: false,
    };

    const job = await queue.add(jobData.type, jobData, jobOptions);
    
    logger.info(`Job ${job.id} added to queue`, {
      jobId: job.id,
      type: jobData.type,
      priority: jobData.priority,
      userId: jobData.userId
    });

    return job;
    
  } catch (error) {
    logger.error('Failed to add job to queue:', error);
    throw error;
  }
}

export async function getJob(jobId: string): Promise<Bull.Job | null> {
  try {
    for (const queue of queues.values()) {
      const job = await queue.getJob(jobId);
      if (job) {
        return job;
      }
    }
    return null;
  } catch (error) {
    logger.error(`Failed to get job ${jobId}:`, error);
    throw error;
  }
}

export async function removeJob(jobId: string): Promise<boolean> {
  try {
    const job = await getJob(jobId);
    if (!job) {
      return false;
    }

    await job.remove();
    logger.info(`Job ${jobId} removed from queue`);
    return true;
    
  } catch (error) {
    logger.error(`Failed to remove job ${jobId}:`, error);
    throw error;
  }
}

export async function getQueueStats() {
  const stats: any = {};
  
  for (const [queueName, queue] of queues) {
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    const delayed = await queue.getDelayed();
    
    stats[queueName] = {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: await queue.isPaused()
    };
  }
  
  return stats;
}

export async function pauseQueue(queueName: string): Promise<void> {
  const queue = queues.get(queueName);
  if (queue) {
    await queue.pause();
    logger.info(`Queue ${queueName} paused`);
  }
}

export async function resumeQueue(queueName: string): Promise<void> {
  const queue = queues.get(queueName);
  if (queue) {
    await queue.resume();
    logger.info(`Queue ${queueName} resumed`);
  }
}

export async function cleanQueue(queueName: string, grace: number = 3600000): Promise<void> {
  const queue = queues.get(queueName);
  if (queue) {
    await queue.clean(grace, 'completed');
    await queue.clean(grace, 'failed');
    logger.info(`Queue ${queueName} cleaned`);
  }
}
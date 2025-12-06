import { PrismaClient, JobType, JobStatus, JobPriority, LogLevel } from '@prisma/client';
import { JobData } from '../types';
import { logger } from '../utils/logger';
import { addJob, getJob, removeJob } from '../queues/queueManager';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export async function createJob(
  userId: string,
  type: JobType,
  payload: any,
  priority: JobPriority = JobPriority.MEDIUM,
  options?: {
    maxRetries?: number;
    delay?: number;
    dependencies?: string[];
    metadata?: Record<string, any>;
  }
): Promise<any> {
  try {
    const jobId = uuidv4();
    
    // Create job in database
    const job = await prisma.job.create({
      data: {
        id: jobId,
        userId,
        type,
        status: JobStatus.PENDING,
        priority,
        payload,
        maxRetries: options?.maxRetries || 3,
        delay: options?.delay,
        metadata: options?.metadata,
        scheduledAt: options?.delay ? new Date(Date.now() + options.delay) : null
      },
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });

    // Create job dependencies if specified
    if (options?.dependencies && options.dependencies.length > 0) {
      await createJobDependencies(jobId, options.dependencies);
    }

    // Create job data for queue
    const jobData: JobData = {
      id: jobId,
      jobId: jobId,
      type,
      payload,
      userId,
      priority,
      maxRetries: options?.maxRetries || 3,
      currentRetry: 0,
      delay: options?.delay,
      metadata: options?.metadata
    };

    // Add to queue
    const bullJob = await addJob(jobData);

    await logJobEvent(jobId, LogLevel.INFO, 'Job created and queued');

    logger.info(`Job created successfully`, {
      jobId,
      type,
      userId,
      priority,
      bullJobId: bullJob.id
    });

    return {
      ...job,
      bullJobId: bullJob.id
    };

  } catch (error) {
    logger.error('Failed to create job:', error);
    throw error;
  }
}

export async function getJobById(jobId: string): Promise<any> {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        user: {
          select: { id: true, email: true }
        },
        dependencies: {
          include: {
            parentJob: { select: { id: true, type: true, status: true } }
          }
        },
        dependents: {
          include: {
            dependentJob: { select: { id: true, type: true, status: true } }
          }
        },
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 50
        }
      }
    });

    if (!job) {
      throw new Error('Job not found');
    }

    // Get queue information
    const bullJob = await getJob(jobId);
    
    return {
      ...job,
      queueInfo: bullJob ? {
        id: bullJob.id,
        attempts: bullJob.attemptsMade,
        progress: bullJob.progress(),
        processedOn: bullJob.processedOn,
        finishedOn: bullJob.finishedOn
      } : null
    };

  } catch (error) {
    logger.error(`Failed to get job ${jobId}:`, error);
    throw error;
  }
}

export async function getJobsByUser(
  userId: string,
  options?: {
    status?: JobStatus;
    type?: JobType;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'priority';
    sortOrder?: 'asc' | 'desc';
  }
): Promise<{ jobs: any[]; total: number }> {
  try {
    const where: any = { userId };
    
    if (options?.status) {
      where.status = options.status;
    }
    
    if (options?.type) {
      where.type = options.type;
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true }
          }
        },
        orderBy: {
          [options?.sortBy || 'createdAt']: options?.sortOrder || 'desc'
        },
        take: options?.limit || 50,
        skip: options?.offset || 0
      }),
      prisma.job.count({ where })
    ]);

    return { jobs, total };

  } catch (error) {
    logger.error(`Failed to get jobs for user ${userId}:`, error);
    throw error;
  }
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  result?: any,
  error?: string
): Promise<any> {
  try {
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (status === JobStatus.ACTIVE && !await getJobStartTime(jobId)) {
      updateData.startedAt = new Date();
    }

    if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
      updateData.completedAt = new Date();
      
      if (result) {
        updateData.result = result;
      }
      
      if (error) {
        updateData.error = error;
      }
    }

    const job = await prisma.job.update({
      where: { id: jobId },
      data: updateData
    });

    logger.info(`Job status updated`, {
      jobId,
      status,
      hasResult: !!result,
      hasError: !!error
    });

    return job;

  } catch (error) {
    logger.error(`Failed to update job status for ${jobId}:`, error);
    throw error;
  }
}

export async function updateJobProgress(
  jobId: string,
  status: JobStatus,
  progress: number,
  result?: any,
  error?: string
): Promise<void> {
  try {
    await updateJobStatus(jobId, status, result, error);
    
    // Update progress in database if needed
    await prisma.job.update({
      where: { id: jobId },
      data: { progress }
    });

  } catch (error) {
    logger.error(`Failed to update job progress for ${jobId}:`, error);
    // Don't throw here to avoid breaking job execution
  }
}

export async function cancelJob(jobId: string): Promise<boolean> {
  try {
    // Remove from queue
    const removed = await removeJob(jobId);
    
    // Update database
    await updateJobStatus(jobId, JobStatus.CANCELLED);
    await logJobEvent(jobId, LogLevel.INFO, 'Job cancelled');

    logger.info(`Job cancelled`, { jobId, removedFromQueue: removed });

    return true;

  } catch (error) {
    logger.error(`Failed to cancel job ${jobId}:`, error);
    throw error;
  }
}

export async function retryJob(jobId: string): Promise<any> {
  try {
    const job = await getJobById(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== JobStatus.FAILED) {
      throw new Error('Only failed jobs can be retried');
    }

    // Create new job with same data
    const newJob = await createJob(
      job.userId,
      job.type,
      job.payload,
      job.priority,
      {
        maxRetries: job.maxRetries,
        metadata: { ...job.metadata, retryOf: jobId }
      }
    );

    await logJobEvent(jobId, LogLevel.INFO, `Job retried as ${newJob.id}`);

    return newJob;

  } catch (error) {
    logger.error(`Failed to retry job ${jobId}:`, error);
    throw error;
  }
}

export async function logJobEvent(
  jobId: string,
  level: LogLevel,
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await prisma.jobLog.create({
      data: {
        jobId,
        level,
        message,
        metadata
      }
    });

  } catch (error) {
    logger.error(`Failed to log event for job ${jobId}:`, error);
    // Don't throw here to avoid breaking job execution
  }
}

export async function getJobLogs(
  jobId: string,
  options?: {
    level?: LogLevel;
    limit?: number;
    offset?: number;
  }
): Promise<any[]> {
  try {
    const where: any = { jobId };
    
    if (options?.level) {
      where.level = options.level;
    }

    const logs = await prisma.jobLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0
    });

    return logs;

  } catch (error) {
    logger.error(`Failed to get logs for job ${jobId}:`, error);
    throw error;
  }
}

async function createJobDependencies(jobId: string, dependencyIds: string[]): Promise<void> {
  try {
    const dependencies = dependencyIds.map(parentJobId => ({
      parentJobId,
      dependentJobId: jobId
    }));

    await prisma.jobDependency.createMany({
      data: dependencies,
      skipDuplicates: true
    });

  } catch (error) {
    logger.error(`Failed to create dependencies for job ${jobId}:`, error);
    throw error;
  }
}

async function getJobStartTime(jobId: string): Promise<Date | null> {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { startedAt: true }
    });

    return job?.startedAt || null;

  } catch (error) {
    logger.error(`Failed to get start time for job ${jobId}:`, error);
    return null;
  }
}

export async function getJobStats(userId?: string): Promise<any> {
  try {
    const where = userId ? { userId } : {};
    
    const [totalJobs, pendingJobs, activeJobs, completedJobs, failedJobs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.count({ where: { ...where, status: JobStatus.PENDING } }),
      prisma.job.count({ where: { ...where, status: JobStatus.ACTIVE } }),
      prisma.job.count({ where: { ...where, status: JobStatus.COMPLETED } }),
      prisma.job.count({ where: { ...where, status: JobStatus.FAILED } })
    ]);

    return {
      total: totalJobs,
      pending: pendingJobs,
      active: activeJobs,
      completed: completedJobs,
      failed: failedJobs,
      cancelled: totalJobs - (pendingJobs + activeJobs + completedJobs + failedJobs)
    };

  } catch (error) {
    logger.error('Failed to get job stats:', error);
    throw error;
  }
}
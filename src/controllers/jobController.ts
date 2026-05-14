import { Request, Response } from 'express';
import {
  createJob,
  getJobById,
  getJobsByUser,
  cancelJob,
  retryJob,
  getJobLogs,
  getJobStats,
  updateJobStatus as updateJobStatusInDB
} from '../services/jobService';
import { getQueueStats } from '../queues/queueManager';
import { logger } from '../utils/logger';
import { JobType, JobPriority, JobStatus, UserRole } from '../types';
import { broadcastJobCreated, broadcastJobStatusChange } from '../services/websocket';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function submitJob(req: Request, res: Response): Promise<void> {
  try {
    const { type, payload, priority, maxRetries, delay, dependencies, metadata } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Validate job type
    if (!type || !Object.values(JobType).includes(type)) {
      res.status(400).json({
        success: false,
        message: 'Valid job type is required',
        availableTypes: Object.values(JobType)
      });
      return;
    }

    // Validate payload
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Job payload is required and must be an object'
      });
      return;
    }

    // Validate priority
    const jobPriority = priority && Object.values(JobPriority).includes(priority) 
      ? priority 
      : JobPriority.MEDIUM;

    const job = await createJob(userId, type, payload, jobPriority, {
      maxRetries,
      delay,
      dependencies,
      metadata
    });

    // Transform job: rename 'payload' to 'data' for frontend compatibility
    const { payload: jobPayload, ...jobWithoutPayload } = job;
    const transformedJob = {
      ...jobWithoutPayload,
      data: jobPayload  // Frontend expects 'data', backend has 'payload'
    };

    // Broadcast job creation to all connected clients (non-blocking)
    try {
      broadcastJobCreated(transformedJob, userId);
    } catch (broadcastError) {
      logger.error('Failed to broadcast job creation:', broadcastError);
      // Continue - don't fail the request if broadcast fails
    }

    res.status(201).json({
      success: true,
      message: 'Job submitted successfully',
      data: { job: transformedJob }
    });

  } catch (error) {
    logger.error('Submit job error:', error);
    console.error('Full error details:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error while submitting job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function getJob(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const job = await getJobById(jobId);

    // Check if user has access to this job
    if (job.userId !== userId && userRole !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    // Transform job: rename 'payload' to 'data' for frontend compatibility
    const { payload: jobPayload, ...jobWithoutPayload } = job;
    const transformedJob = {
      ...jobWithoutPayload,
      data: jobPayload  // Frontend expects 'data', backend has 'payload'
    };

    res.json({
      success: true,
      message: 'Job retrieved successfully',
      data: { job: transformedJob }
    });

  } catch (error) {
    logger.error('Get job error:', error);
    
    if (error instanceof Error && error.message === 'Job not found') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving job'
      });
    }
  }
}

export async function getJobs(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Parse query parameters
    const {
      status,
      type,
      limit = '50',
      offset = '0',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      user: targetUserId
    } = req.query;

    // Validate parameters
    const parsedLimit = Math.min(parseInt(limit as string), 100);
    const parsedOffset = Math.max(parseInt(offset as string), 0);

    // Determine which user's jobs to fetch
    let queryUserId = userId;
    if (targetUserId && userRole === UserRole.ADMIN) {
      queryUserId = targetUserId as string;
    }

    const options = {
      status: status as JobStatus,
      type: type as JobType,
      limit: parsedLimit,
      offset: parsedOffset,
      sortBy: sortBy as 'createdAt' | 'updatedAt' | 'priority',
      sortOrder: sortOrder as 'asc' | 'desc'
    };

    const result = await getJobsByUser(queryUserId, options);

    // Transform jobs: rename 'payload' to 'data' for frontend compatibility
    const transformedJobs = result.jobs.map((job: any) => {
      const { payload: jobPayload, ...jobWithoutPayload } = job;
      return {
        ...jobWithoutPayload,
        data: jobPayload  // Frontend expects 'data', backend has 'payload'
      };
    });

    res.json({
      success: true,
      message: 'Jobs retrieved successfully',
      data: {
        jobs: transformedJobs,
        pagination: {
          total: result.total,
          limit: parsedLimit,
          offset: parsedOffset,
          pages: Math.ceil(result.total / parsedLimit)
        }
      }
    });

  } catch (error) {
    logger.error('Get jobs error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving jobs'
    });
  }
}

export async function deleteJob(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Check if job exists and user has access
    const job = await getJobById(jobId);
    
    if (job.userId !== userId && userRole !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    // Check if job can be cancelled
    if ([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(job.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot cancel job with status: ${job.status}`
      });
      return;
    }

    const cancelled = await cancelJob(jobId);

    res.json({
      success: true,
      message: 'Job cancelled successfully',
      data: { cancelled }
    });

  } catch (error) {
    logger.error('Cancel job error:', error);
    
    if (error instanceof Error && error.message === 'Job not found') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while cancelling job'
      });
    }
  }
}

export async function retryFailedJob(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Check if job exists and user has access
    const job = await getJobById(jobId);
    
    if (job.userId !== userId && userRole !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    const newJob = await retryJob(jobId);

    res.json({
      success: true,
      message: 'Job retry scheduled successfully',
      data: { job: newJob }
    });

  } catch (error) {
    logger.error('Retry job error:', error);
    
    if (error instanceof Error && error.message === 'Job not found') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else if (error instanceof Error && error.message === 'Only failed jobs can be retried') {
      res.status(400).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrying job'
      });
    }
  }
}

export async function getJobLogEntries(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Check if job exists and user has access
    const job = await getJobById(jobId);
    
    if (job.userId !== userId && userRole !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    const { level, limit = '100', offset = '0' } = req.query;

    const logs = await getJobLogs(jobId, {
      level: level as any,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({
      success: true,
      message: 'Job logs retrieved successfully',
      data: { logs }
    });

  } catch (error) {
    logger.error('Get job logs error:', error);
    
    if (error instanceof Error && error.message === 'Job not found') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving job logs'
      });
    }
  }
}

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Get job stats (admin sees all, users see their own)
    const jobStats = await getJobStats(userRole === UserRole.ADMIN ? undefined : userId);

    // Get queue stats (only for admin)
    let queueStats = {};
    if (userRole === UserRole.ADMIN) {
      queueStats = await getQueueStats();
    }

    res.json({
      success: true,
      message: 'Dashboard stats retrieved successfully',
      data: {
        jobStats,
        queueStats: userRole === UserRole.ADMIN ? queueStats : undefined
      }
    });

  } catch (error) {
    logger.error('Get dashboard stats error:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving dashboard stats'
    });
  }
}

/**
 * Returns jobs grouped into Kanban columns (QUEUED / PROCESSING / COMPLETED / FAILED).
 *
 * Role-based scoping:
 *   - USER    → only jobs owned by the requesting user (where.userId = req.user.userId)
 *   - MANAGER → all jobs in the system (no userId filter)
 *   - ADMIN   → all jobs in the system (no userId filter)
 *
 * Capped at 200 records per request; ordered by priority descending.
 */
export async function getKanbanJobs(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Regular users see only their own jobs; managers and admins see all
    const where = (userRole === UserRole.MANAGER || userRole === UserRole.ADMIN)
      ? {}
      : { userId };

    const jobs = await prisma.job.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, fullName: true }
        }
      },
      orderBy: {
        priority: 'desc'
      },
      take: 200
    });

    type DbJobRow = typeof jobs[number];

    interface KanbanJob {
      id: string;
      title: string;
      type: string;
      priority: string;
      status: string;
      assignees: string[];
      createdAt: Date;
      updatedAt: Date;
      progress: number;
      tags: string[];
      comments: number;
      attachments: number;
      data: unknown;
      createdBy: string | undefined;
    }

    // Group jobs by status for kanban board
    const groupedJobs: Record<'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED', KanbanJob[]> = {
      QUEUED: [],
      PROCESSING: [],
      COMPLETED: [],
      FAILED: []
    };

    jobs.forEach((job: DbJobRow) => {
      const kanbanJob: KanbanJob = {
        id: job.id,
        title: job.type.replace(/_/g, ' '),
        type: job.type,
        priority: job.priority,
        status: job.status,
        assignees: [job.user?.fullName || job.user?.email || 'Unknown'],
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        progress: job.progress || 0,
        tags: [
          job.type.split('_')[0],
          job.priority === 'HIGH' ? 'HIGH' : job.priority === 'MEDIUM' ? 'MEDIUM' : 'LOW'
        ],
        comments: 0,
        attachments: 0,
        data: job.payload,
        createdBy: job.user?.fullName || job.user?.email
      };

      // Map job status to kanban columns
      const statusMap: { [key: string]: keyof typeof groupedJobs } = {
        'pending': 'QUEUED',
        'active': 'PROCESSING',
        'completed': 'COMPLETED',
        'failed': 'FAILED',
        'cancelled': 'FAILED'
      };

      const column = statusMap[job.status] || 'QUEUED';
      groupedJobs[column].push(kanbanJob);
    });

    res.json({
      success: true,
      message: 'Kanban jobs retrieved successfully',
      jobs: groupedJobs
    });

  } catch (error) {
    logger.error('Get kanban jobs error:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving kanban jobs'
    });
  }
}

export async function updateJobStatus(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const { status } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Validate status
    if (!status || !Object.values(JobStatus).includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Valid job status is required',
        availableStatuses: Object.values(JobStatus)
      });
      return;
    }

    // Check if job exists and user has access
    const job = await getJobById(jobId);

    if (job.userId !== userId && userRole !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    const previousStatus = job.status;

    // Persist the new status to the job record in the database
    await updateJobStatusInDB(jobId, status);

    // Broadcast status change to all connected clients
    broadcastJobStatusChange(jobId, status, userId);

    res.json({
      success: true,
      message: 'Job status updated successfully',
      data: {
        jobId,
        newStatus: status,
        previousStatus
      }
    });

  } catch (error) {
    logger.error('Update job status error:', error);

    if (error instanceof Error && error.message === 'Job not found') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while updating job status'
      });
    }
  }
}
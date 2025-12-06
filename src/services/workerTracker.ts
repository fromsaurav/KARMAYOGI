import { PrismaClient, WorkerStatus, JobStatus } from '@prisma/client';
import { broadcastWorkerStats, broadcastWorkerStatus, broadcastQueueDepth } from './websocket';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

interface WorkerInfo {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'paused' | 'failed';
  currentJob?: string;
  jobsProcessed: number;
  jobsFailed: number;
  avgProcessingTime: number;
  lastActive: Date;
  startedAt: Date;
}

interface QueueDepthInfo {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

export class WorkerTracker {
  private broadcastInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeWorkerMonitoring();
  }

  private initializeWorkerMonitoring() {
    // Broadcast worker stats every 5 seconds
    this.broadcastInterval = setInterval(async () => {
      try {
        await this.broadcastWorkerStats();
      } catch (error) {
        logger.error('Error broadcasting worker stats:', error);
      }
    }, 5000);

    logger.info('Worker tracker initialized with 5-second broadcast interval');
  }

  private async broadcastWorkerStats() {
    const stats = await this.getWorkerStats();
    const queueDepth = await this.getQueueDepth();

    const fullStats = {
      workers: stats.workers,
      queueDepth,
      totalProcessed: stats.totalProcessed,
      totalFailed: stats.totalFailed,
      activeWorkers: stats.activeWorkers,
      idleWorkers: stats.idleWorkers,
      totalWorkers: stats.totalWorkers
    };

    // Broadcast to admin and manager roles
    broadcastWorkerStats(fullStats);
    broadcastQueueDepth(queueDepth);
  }

  public async getWorkerStats() {
    try {
      // Get all worker health records
      const workers = await prisma.workerHealth.findMany({
        orderBy: { lastHeartbeat: 'desc' }
      });

      // Transform to frontend format
      const workerInfos: WorkerInfo[] = workers.map(worker => {
        // Map database WorkerStatus to frontend status
        let status: 'idle' | 'busy' | 'paused' | 'failed' = 'idle';
        if (worker.status === WorkerStatus.BUSY) status = 'busy';
        else if (worker.status === WorkerStatus.IDLE) status = 'idle';
        else if (worker.status === WorkerStatus.UNHEALTHY) status = 'failed';

        // Calculate average processing time (stored in metadata if available)
        const avgTime = (worker.metadata as any)?.avgProcessingTime || 0;

        return {
          id: worker.workerId,
          name: `Worker-${worker.workerId.slice(0, 8)}`,
          status,
          currentJob: worker.currentJobId || undefined,
          jobsProcessed: worker.processedJobs,
          jobsFailed: worker.errors,
          avgProcessingTime: avgTime,
          lastActive: worker.lastHeartbeat,
          startedAt: worker.createdAt
        };
      });

      const activeWorkers = workerInfos.filter(w => w.status === 'busy').length;
      const idleWorkers = workerInfos.filter(w => w.status === 'idle').length;

      // Calculate totals
      const totalProcessed = workerInfos.reduce((sum, w) => sum + w.jobsProcessed, 0);
      const totalFailed = workerInfos.reduce((sum, w) => sum + w.jobsFailed, 0);

      return {
        workers: workerInfos,
        totalWorkers: workerInfos.length,
        activeWorkers,
        idleWorkers,
        totalProcessed,
        totalFailed
      };
    } catch (error) {
      logger.error('Error fetching worker stats:', error);
      return {
        workers: [],
        totalWorkers: 0,
        activeWorkers: 0,
        idleWorkers: 0,
        totalProcessed: 0,
        totalFailed: 0
      };
    }
  }

  public async getQueueDepth(): Promise<QueueDepthInfo> {
    try {
      // Get counts from Job table grouped by status
      const statusCounts = await prisma.job.groupBy({
        by: ['status'],
        _count: { id: true }
      });

      const depth: QueueDepthInfo = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0
      };

      statusCounts.forEach(({ status, _count }) => {
        const count = _count.id;
        switch (status) {
          case JobStatus.PENDING:
            depth.waiting = count;
            break;
          case JobStatus.ACTIVE:
            depth.active = count;
            break;
          case JobStatus.COMPLETED:
            depth.completed = count;
            break;
          case JobStatus.FAILED:
            depth.failed = count;
            break;
          case JobStatus.DELAYED:
            depth.delayed = count;
            break;
        }
      });

      depth.total = depth.waiting + depth.active + depth.delayed;

      return depth;
    } catch (error) {
      logger.error('Error fetching queue depth:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0
      };
    }
  }

  public async updateWorkerStatus(workerId: string, status: WorkerStatus, currentJobId?: string) {
    try {
      await prisma.workerHealth.upsert({
        where: { workerId },
        update: {
          status,
          currentJobId,
          lastHeartbeat: new Date()
        },
        create: {
          workerId,
          status,
          currentJobId,
          lastHeartbeat: new Date()
        }
      });

      // Broadcast status change
      const statusMap: Record<WorkerStatus, 'idle' | 'busy' | 'failed' | 'paused'> = {
        [WorkerStatus.IDLE]: 'idle',
        [WorkerStatus.BUSY]: 'busy',
        [WorkerStatus.UNHEALTHY]: 'failed',
        [WorkerStatus.HEALTHY]: 'idle'
      };

      broadcastWorkerStatus(workerId, statusMap[status], currentJobId);
    } catch (error) {
      logger.error('Error updating worker status:', error);
    }
  }

  public async incrementWorkerProcessed(workerId: string) {
    try {
      await prisma.workerHealth.update({
        where: { workerId },
        data: {
          processedJobs: { increment: 1 },
          lastHeartbeat: new Date()
        }
      });
    } catch (error) {
      logger.error('Error incrementing worker processed count:', error);
    }
  }

  public async incrementWorkerErrors(workerId: string) {
    try {
      await prisma.workerHealth.update({
        where: { workerId },
        data: {
          errors: { increment: 1 },
          lastHeartbeat: new Date()
        }
      });
    } catch (error) {
      logger.error('Error incrementing worker errors:', error);
    }
  }

  public async retryFailedJobs(): Promise<number> {
    try {
      const failedJobs = await prisma.job.findMany({
        where: { status: JobStatus.FAILED }
      });

      // Reset to PENDING status
      await prisma.job.updateMany({
        where: { status: JobStatus.FAILED },
        data: {
          status: JobStatus.PENDING,
          currentRetry: 0,
          error: null,
          failedAt: null,
          workerId: null
        }
      });

      logger.info(`Retrying ${failedJobs.length} failed jobs`);
      return failedJobs.length;
    } catch (error) {
      logger.error('Error retrying failed jobs:', error);
      return 0;
    }
  }

  public cleanup() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
  }
}

// Singleton instance
let workerTrackerInstance: WorkerTracker | null = null;

export function initializeWorkerTracker(): WorkerTracker {
  if (!workerTrackerInstance) {
    workerTrackerInstance = new WorkerTracker();
  }
  return workerTrackerInstance;
}

export function getWorkerTracker(): WorkerTracker | null {
  return workerTrackerInstance;
}

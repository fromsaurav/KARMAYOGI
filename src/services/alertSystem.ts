// Alert system for monitoring queue depth, failure rates, and worker health
// Automatically creates system alerts when thresholds are exceeded

import { PrismaClient, AlertLevel, AlertType, JobStatus, WorkerStatus } from '@prisma/client';
import { logger } from '../utils/logger';
import { broadcastSystemAlert } from './websocket';

const prisma = new PrismaClient();

interface AlertThresholds {
  queueDepth: {
    warning: number;
    critical: number;
  };
  failureRate: {
    warning: number; // percentage
    critical: number; // percentage
  };
  workerHealth: {
    minHealthyWorkers: number;
    maxResponseTime: number; // milliseconds
  };
  performance: {
    maxAvgProcessingTime: number; // milliseconds
  };
}

export class AlertSystem {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private checkInterval: number = 60000; // Check every 60 seconds

  private thresholds: AlertThresholds = {
    queueDepth: {
      warning: 50,
      critical: 100
    },
    failureRate: {
      warning: 10, // 10% failure rate
      critical: 25 // 25% failure rate
    },
    workerHealth: {
      minHealthyWorkers: 1,
      maxResponseTime: 30000 // 30 seconds
    },
    performance: {
      maxAvgProcessingTime: 300000 // 5 minutes
    }
  };

  constructor(customThresholds?: Partial<AlertThresholds>) {
    if (customThresholds) {
      this.thresholds = { ...this.thresholds, ...customThresholds };
    }
  }

  /**
   * Start monitoring system health and generating alerts
   */
  public startMonitoring(): void {
    if (this.monitoringInterval) {
      logger.warn('Alert system already monitoring');
      return;
    }

    logger.info('🚨 Alert system started monitoring');

    // Run initial check
    this.performHealthChecks();

    // Schedule periodic checks
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.checkInterval);
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Alert system stopped monitoring');
    }
  }

  /**
   * Perform all health checks
   */
  private async performHealthChecks(): Promise<void> {
    try {
      await Promise.all([
        this.checkQueueDepth(),
        this.checkFailureRate(),
        this.checkWorkerHealth(),
        this.checkSystemPerformance()
      ]);
    } catch (error) {
      logger.error('Error during health checks:', error);
    }
  }

  /**
   * Check queue depth and create alerts if thresholds exceeded
   */
  private async checkQueueDepth(): Promise<void> {
    try {
      const queueCounts = await prisma.job.groupBy({
        by: ['status'],
        _count: { id: true }
      });

      const waiting = queueCounts.find(c => c.status === JobStatus.PENDING)?._count.id || 0;
      const active = queueCounts.find(c => c.status === JobStatus.ACTIVE)?._count.id || 0;
      const totalQueued = waiting + active;

      // Check if we need to create an alert
      if (totalQueued >= this.thresholds.queueDepth.critical) {
        await this.createAlert({
          level: AlertLevel.CRITICAL,
          type: AlertType.QUEUE_DEPTH,
          message: `Critical queue depth: ${totalQueued} jobs in queue`,
          action: 'Scale up workers immediately or investigate job processing delays',
          data: {
            waiting,
            active,
            total: totalQueued,
            threshold: this.thresholds.queueDepth.critical
          }
        });
      } else if (totalQueued >= this.thresholds.queueDepth.warning) {
        await this.createAlert({
          level: AlertLevel.WARNING,
          type: AlertType.QUEUE_DEPTH,
          message: `High queue depth: ${totalQueued} jobs in queue`,
          action: 'Consider scaling up workers or monitoring queue growth',
          data: {
            waiting,
            active,
            total: totalQueued,
            threshold: this.thresholds.queueDepth.warning
          }
        });
      } else {
        // Queue depth is normal, resolve any existing queue depth alerts
        await this.resolveAlertsByType(AlertType.QUEUE_DEPTH);
      }
    } catch (error) {
      logger.error('Error checking queue depth:', error);
    }
  }

  /**
   * Check job failure rate and create alerts if thresholds exceeded
   */
  private async checkFailureRate(): Promise<void> {
    try {
      // Get jobs from the last hour
      const oneHourAgo = new Date(Date.now() - 3600000);

      const recentJobs = await prisma.job.groupBy({
        by: ['status'],
        where: {
          createdAt: { gte: oneHourAgo }
        },
        _count: { id: true }
      });

      const completed = recentJobs.find(c => c.status === JobStatus.COMPLETED)?._count.id || 0;
      const failed = recentJobs.find(c => c.status === JobStatus.FAILED)?._count.id || 0;
      const total = completed + failed;

      if (total === 0) return; // No jobs to analyze

      const failureRate = (failed / total) * 100;

      if (failureRate >= this.thresholds.failureRate.critical) {
        await this.createAlert({
          level: AlertLevel.CRITICAL,
          type: AlertType.FAILURE_RATE,
          message: `Critical failure rate: ${failureRate.toFixed(1)}% of jobs failing`,
          action: 'Investigate job failures immediately - check logs and worker health',
          data: {
            failureRate: failureRate.toFixed(1),
            failed,
            total,
            threshold: this.thresholds.failureRate.critical,
            timeWindow: '1 hour'
          }
        });
      } else if (failureRate >= this.thresholds.failureRate.warning) {
        await this.createAlert({
          level: AlertLevel.WARNING,
          type: AlertType.FAILURE_RATE,
          message: `Elevated failure rate: ${failureRate.toFixed(1)}% of jobs failing`,
          action: 'Monitor job failures and investigate common error patterns',
          data: {
            failureRate: failureRate.toFixed(1),
            failed,
            total,
            threshold: this.thresholds.failureRate.warning,
            timeWindow: '1 hour'
          }
        });
      } else {
        // Failure rate is acceptable, resolve existing alerts
        await this.resolveAlertsByType(AlertType.FAILURE_RATE);
      }
    } catch (error) {
      logger.error('Error checking failure rate:', error);
    }
  }

  /**
   * Check worker health status
   */
  private async checkWorkerHealth(): Promise<void> {
    try {
      const workers = await prisma.workerHealth.findMany({
        where: {
          lastHeartbeat: {
            gte: new Date(Date.now() - 60000) // Active in last minute
          }
        }
      });

      const healthyWorkers = workers.filter(w =>
        w.status === WorkerStatus.HEALTHY || w.status === WorkerStatus.IDLE
      );

      const unhealthyWorkers = workers.filter(w =>
        w.status === WorkerStatus.UNHEALTHY
      );

      // Check if we have enough healthy workers
      if (healthyWorkers.length < this.thresholds.workerHealth.minHealthyWorkers) {
        await this.createAlert({
          level: AlertLevel.CRITICAL,
          type: AlertType.WORKER_HEALTH,
          message: `Insufficient healthy workers: only ${healthyWorkers.length} available`,
          action: 'Start additional workers immediately or investigate worker failures',
          data: {
            healthyWorkers: healthyWorkers.length,
            unhealthyWorkers: unhealthyWorkers.length,
            totalWorkers: workers.length,
            threshold: this.thresholds.workerHealth.minHealthyWorkers
          }
        });
      } else if (unhealthyWorkers.length > 0) {
        await this.createAlert({
          level: AlertLevel.WARNING,
          type: AlertType.WORKER_HEALTH,
          message: `${unhealthyWorkers.length} unhealthy worker(s) detected`,
          action: 'Investigate unhealthy workers and restart if necessary',
          data: {
            healthyWorkers: healthyWorkers.length,
            unhealthyWorkers: unhealthyWorkers.length,
            totalWorkers: workers.length,
            unhealthyWorkerIds: unhealthyWorkers.map(w => w.workerId)
          }
        });
      } else {
        // All workers healthy
        await this.resolveAlertsByType(AlertType.WORKER_HEALTH);
      }
    } catch (error) {
      logger.error('Error checking worker health:', error);
    }
  }

  /**
   * Check overall system performance
   */
  private async checkSystemPerformance(): Promise<void> {
    try {
      // Get completed jobs from the last hour
      const oneHourAgo = new Date(Date.now() - 3600000);

      const completedJobs = await prisma.job.findMany({
        where: {
          status: JobStatus.COMPLETED,
          completedAt: { gte: oneHourAgo },
          startedAt: { not: null }
        },
        select: {
          startedAt: true,
          completedAt: true
        }
      });

      if (completedJobs.length === 0) return;

      // Calculate average processing time
      const totalProcessingTime = completedJobs.reduce((acc, job) => {
        const duration = new Date(job.completedAt!).getTime() - new Date(job.startedAt!).getTime();
        return acc + duration;
      }, 0);

      const avgProcessingTime = totalProcessingTime / completedJobs.length;

      if (avgProcessingTime > this.thresholds.performance.maxAvgProcessingTime) {
        await this.createAlert({
          level: AlertLevel.WARNING,
          type: AlertType.SYSTEM_PERFORMANCE,
          message: `Slow job processing: average ${(avgProcessingTime / 1000).toFixed(1)}s per job`,
          action: 'Investigate worker performance or optimize job processing logic',
          data: {
            avgProcessingTimeMs: Math.round(avgProcessingTime),
            avgProcessingTimeSec: (avgProcessingTime / 1000).toFixed(1),
            threshold: this.thresholds.performance.maxAvgProcessingTime,
            sampleSize: completedJobs.length,
            timeWindow: '1 hour'
          }
        });
      } else {
        await this.resolveAlertsByType(AlertType.SYSTEM_PERFORMANCE);
      }
    } catch (error) {
      logger.error('Error checking system performance:', error);
    }
  }

  /**
   * Create a new system alert if one doesn't already exist
   */
  private async createAlert(alertData: {
    level: AlertLevel;
    type: AlertType;
    message: string;
    action?: string;
    data?: any;
  }): Promise<void> {
    try {
      // Check if similar unresolved alert already exists
      const existingAlert = await prisma.systemAlert.findFirst({
        where: {
          type: alertData.type,
          level: alertData.level,
          resolved: false,
          createdAt: {
            gte: new Date(Date.now() - 300000) // Within last 5 minutes
          }
        }
      });

      if (existingAlert) {
        // Alert already exists, don't create duplicate
        return;
      }

      // Create new alert
      const alert = await prisma.systemAlert.create({
        data: alertData
      });

      logger.warn(`[ALERT] ${alertData.level}: ${alertData.message}`);

      // Broadcast alert to admin users via WebSocket
      broadcastSystemAlert(alert);
    } catch (error) {
      logger.error('Error creating alert:', error);
    }
  }

  /**
   * Resolve alerts of a specific type
   */
  private async resolveAlertsByType(type: AlertType): Promise<void> {
    try {
      const result = await prisma.systemAlert.updateMany({
        where: {
          type,
          resolved: false
        },
        data: {
          resolved: true,
          resolvedAt: new Date()
        }
      });

      if (result.count > 0) {
        logger.info(`Resolved ${result.count} alert(s) of type ${type}`);
      }
    } catch (error) {
      logger.error('Error resolving alerts:', error);
    }
  }

  /**
   * Get all active alerts
   */
  public async getActiveAlerts(): Promise<any[]> {
    try {
      return await prisma.systemAlert.findMany({
        where: { resolved: false },
        orderBy: [
          { level: 'desc' }, // CRITICAL first
          { createdAt: 'desc' }
        ]
      });
    } catch (error) {
      logger.error('Error fetching active alerts:', error);
      return [];
    }
  }

  /**
   * Manually resolve an alert
   */
  public async resolveAlert(alertId: string): Promise<boolean> {
    try {
      await prisma.systemAlert.update({
        where: { id: alertId },
        data: {
          resolved: true,
          resolvedAt: new Date()
        }
      });

      logger.info(`Alert ${alertId} manually resolved`);
      return true;
    } catch (error) {
      logger.error('Error resolving alert:', error);
      return false;
    }
  }

  /**
   * Update alert thresholds
   */
  public updateThresholds(newThresholds: Partial<AlertThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Alert thresholds updated', this.thresholds);
  }

  /**
   * Get current thresholds
   */
  public getThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }

  /**
   * Cleanup - stop monitoring
   */
  public cleanup(): void {
    this.stopMonitoring();
    logger.info('Alert system cleaned up');
  }
}

// Singleton instance
let alertSystemInstance: AlertSystem | null = null;

export function initializeAlertSystem(thresholds?: Partial<AlertThresholds>): AlertSystem {
  if (!alertSystemInstance) {
    alertSystemInstance = new AlertSystem(thresholds);
    alertSystemInstance.startMonitoring();
  }
  return alertSystemInstance;
}

export function getAlertSystem(): AlertSystem | null {
  return alertSystemInstance;
}

import express from 'express';
import { protectRoute } from '../middleware/protectRoute';
import { requireManager, requireAdmin } from '../middleware/roleMiddleware';
import { getJobStats } from '../services/jobService';
import { getQueueStats } from '../queues/queueManager';
import { logger } from '../utils/logger';

const router = express.Router();

interface AnalyticsData {
  performanceMetrics: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
    successRate: number;
  };
  jobStatistics: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    activeJobs: number;
    pendingJobs: number;
  };
  timeSeriesData: {
    timestamp: string;
    jobs: number;
    responseTime: number;
    errors: number;
  }[];
  jobTypeDistribution: {
    type: string;
    count: number;
    percentage: number;
  }[];
  workerUtilization: {
    workerId: string;
    utilization: number;
    jobsProcessed: number;
  }[];
}

// Get analytics data - Managers and Admins only
router.get('/data',
  protectRoute,
  requireManager,  // Only managers and admins can access analytics
  async (req, res) => {
    try {
      const [jobStats, queueStats] = await Promise.all([
        getJobStats(),
        getQueueStats()
      ]);

      // Generate mock time series data for the last 24 hours
      const now = new Date();
      const timeSeriesData = Array.from({ length: 24 }, (_, i) => {
        const timestamp = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
        return {
          timestamp: timestamp.toLocaleTimeString('en-US', { hour: '2-digit' }),
          jobs: Math.floor(Math.random() * 100) + 20,
          responseTime: Math.floor(Math.random() * 500) + 100,
          errors: Math.floor(Math.random() * 10)
        };
      });

      // Generate job type distribution
      const jobTypes = ['FILE_PROCESSING', 'DATA_ANALYTICS', 'EMAIL_CAMPAIGN', 'API_INTEGRATION', 'CUSTOM_SCRIPT'];
      const jobTypeDistribution = jobTypes.map(type => {
        const count = Math.floor(Math.random() * 50) + 10;
        return {
          type,
          count,
          percentage: Math.round((count / 200) * 100)
        };
      });

      // Generate worker utilization data
      const workerUtilization = Array.from({ length: 5 }, (_, i) => ({
        workerId: `Worker-${i + 1}`,
        utilization: Math.floor(Math.random() * 100),
        jobsProcessed: Math.floor(Math.random() * 1000) + 100
      }));

      const analytics: AnalyticsData = {
        performanceMetrics: {
          avgResponseTime: Math.floor(Math.random() * 300) + 150,
          throughput: Math.floor(Math.random() * 100) + 50,
          errorRate: Math.round((Math.random() * 5 + 1) * 100) / 100,
          successRate: Math.round((95 + Math.random() * 4) * 100) / 100
        },
        jobStatistics: {
          totalJobs: jobStats.totalJobs || Math.floor(Math.random() * 10000) + 5000,
          completedJobs: jobStats.completedJobs || Math.floor(Math.random() * 8000) + 4000,
          failedJobs: jobStats.failedJobs || Math.floor(Math.random() * 500) + 100,
          activeJobs: jobStats.activeJobs || Math.floor(Math.random() * 50) + 10,
          pendingJobs: jobStats.pendingJobs || Math.floor(Math.random() * 200) + 50
        },
        timeSeriesData,
        jobTypeDistribution,
        workerUtilization
      };

      res.json({
        success: true,
        message: 'Analytics data retrieved successfully',
        data: analytics
      });

    } catch (error) {
      logger.error('Failed to get analytics data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics data'
      });
    }
  }
);

// Get performance metrics
router.get('/performance',
  protectRoute,
  async (req, res) => {
    try {
      // In a real application, this would aggregate actual performance data
      const performanceData = {
        responseTime: {
          avg: Math.floor(Math.random() * 300) + 100,
          p95: Math.floor(Math.random() * 500) + 200,
          p99: Math.floor(Math.random() * 1000) + 500
        },
        throughput: {
          current: Math.floor(Math.random() * 100) + 50,
          peak: Math.floor(Math.random() * 200) + 150
        },
        errorRate: Math.round((Math.random() * 5) * 100) / 100,
        uptime: 99.9 - Math.random() * 0.5
      };

      res.json({
        success: true,
        message: 'Performance metrics retrieved successfully',
        data: performanceData
      });

    } catch (error) {
      logger.error('Failed to get performance metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve performance metrics'
      });
    }
  }
);

// Get worker analytics - Admin only
router.get('/workers',
  protectRoute,
  requireAdmin,  // Only admins can see worker analytics
  async (req, res) => {
    try {
      // Generate worker analytics data
      const workerData = Array.from({ length: 10 }, (_, i) => ({
        id: `worker-${i + 1}`,
        name: `Worker ${i + 1}`,
        status: Math.random() > 0.1 ? 'active' : 'idle',
        jobsProcessed: Math.floor(Math.random() * 1000) + 100,
        avgProcessingTime: Math.floor(Math.random() * 5000) + 1000,
        errors: Math.floor(Math.random() * 10),
        lastActive: new Date(Date.now() - Math.random() * 3600000).toISOString()
      }));

      res.json({
        success: true,
        message: 'Worker analytics retrieved successfully',
        data: {
          workers: workerData,
          summary: {
            total: workerData.length,
            active: workerData.filter(w => w.status === 'active').length,
            idle: workerData.filter(w => w.status === 'idle').length,
            totalJobsProcessed: workerData.reduce((sum, w) => sum + w.jobsProcessed, 0)
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get worker analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve worker analytics'
      });
    }
  }
);

export default router;
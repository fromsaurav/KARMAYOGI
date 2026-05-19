import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { JobStatus, UserRole } from '../types';
import { getQueueStats } from '../queues/queueManager';

const prisma = new PrismaClient();

/**
 * Get user-specific dashboard statistics
 * Accessible by: USER, MANAGER, ADMIN
 */
export async function getUserStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Get user's job statistics — single groupBy instead of 5 count queries
    const statusCounts = await prisma.job.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true }
    });
    const countByStatus = new Map(statusCounts.map(r => [r.status, r._count.id]));
    const completedJobs = countByStatus.get(JobStatus.COMPLETED) ?? 0;
    const activeJobs    = countByStatus.get(JobStatus.ACTIVE)    ?? 0;
    const failedJobs    = countByStatus.get(JobStatus.FAILED)    ?? 0;
    const pendingJobs   = countByStatus.get(JobStatus.PENDING)   ?? 0;
    const totalJobs     = [...countByStatus.values()].reduce((a, b) => a + b, 0);

    // Get recent jobs (last 10)
    const recentJobs = await prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        status: true,
        priority: true,
        createdAt: true,
        completedAt: true,
        progress: true
      }
    });

    // Calculate completion rate
    const completionRate = totalJobs > 0
      ? Math.round((completedJobs / totalJobs) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        stats: {
          total: totalJobs,
          completed: completedJobs,
          active: activeJobs,
          failed: failedJobs,
          pending: pendingJobs,
          completionRate
        },
        recentJobs
      }
    });

  } catch (error) {
    logger.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics'
    });
  }
}

/**
 * Get manager-specific dashboard statistics
 * Accessible by: MANAGER, ADMIN
 */
export async function getManagerStats(req: Request, res: Response): Promise<void> {
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

    // For now, show stats for all users in the system
    // In a real app, you'd filter by team/manager assignment
    const [totalUsers, totalJobs, completedJobs, activeJobs, failedJobs] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.USER } }),
      prisma.job.count(),
      prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
      prisma.job.count({ where: { status: JobStatus.ACTIVE } }),
      prisma.job.count({ where: { status: JobStatus.FAILED } })
    ]);

    // Get team completion rate
    const completionRate = totalJobs > 0
      ? Math.round((completedJobs / totalJobs) * 100)
      : 0;

    // Get recent team activity (last 20 jobs from all team members)
    const recentTeamJobs = await prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        type: true,
        status: true,
        priority: true,
        createdAt: true,
        completedAt: true,
        progress: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        stats: {
          teamMembers: totalUsers,
          totalTasks: totalJobs,
          completed: completedJobs,
          active: activeJobs,
          failed: failedJobs,
          completionRate,
          pendingReview: 0 // Placeholder for future feature
        },
        recentActivity: recentTeamJobs
      }
    });

  } catch (error) {
    logger.error('Get manager stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch manager statistics'
    });
  }
}

/**
 * Get team members list
 * Accessible by: MANAGER, ADMIN
 */
export async function getTeamMembers(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Get all users with their job statistics
    const users = await prisma.user.findMany({
      where: { role: UserRole.USER },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        profilePic: true,
        createdAt: true
      }
    });

    // Get job counts for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const [totalJobs, completedJobs, activeJobs] = await Promise.all([
          prisma.job.count({ where: { userId: user.id } }),
          prisma.job.count({ where: { userId: user.id, status: JobStatus.COMPLETED } }),
          prisma.job.count({ where: { userId: user.id, status: JobStatus.ACTIVE } })
        ]);

        const successRate = totalJobs > 0
          ? Math.round((completedJobs / totalJobs) * 100)
          : 0;

        return {
          ...user,
          stats: {
            totalJobs,
            completedJobs,
            activeJobs,
            successRate
          }
        };
      })
    );

    res.json({
      success: true,
      data: {
        teamMembers: usersWithStats
      }
    });

  } catch (error) {
    logger.error('Get team members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team members'
    });
  }
}

/**
 * Get admin-specific dashboard statistics
 * Accessible by: ADMIN only
 */
export async function getAdminStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Get comprehensive system statistics
    const [
      totalUsers,
      totalManagers,
      totalAdmins,
      totalJobs,
      completedJobs,
      activeJobs,
      failedJobs,
      pendingJobs
    ] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.USER } }),
      prisma.user.count({ where: { role: UserRole.MANAGER } }),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
      prisma.job.count(),
      prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
      prisma.job.count({ where: { status: JobStatus.ACTIVE } }),
      prisma.job.count({ where: { status: JobStatus.FAILED } }),
      prisma.job.count({ where: { status: JobStatus.PENDING } })
    ]);

    // Get queue statistics
    let queueStats;
    try {
      queueStats = await getQueueStats();
    } catch (error) {
      logger.warn('Failed to get queue stats:', error);
      queueStats = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
      };
    }

    // Calculate success rate
    const successRate = totalJobs > 0
      ? Math.round((completedJobs / totalJobs) * 100)
      : 0;

    // Get recent system activity
    const recentActivity = await prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers: totalUsers + totalManagers + totalAdmins,
          users: totalUsers,
          managers: totalManagers,
          admins: totalAdmins,
          totalJobs,
          completedJobs,
          activeJobs,
          failedJobs,
          pendingJobs,
          queueLength: queueStats.waiting,
          successRate,
          systemUptime: '99.9%', // Placeholder
          healthScore: 95 // Placeholder
        },
        queueStats,
        recentActivity
      }
    });

  } catch (error) {
    logger.error('Get admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin statistics'
    });
  }
}

/**
 * Get all users (with role management capabilities)
 * Accessible by: ADMIN only
 */
export async function getAllUsers(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Get all users with their statistics
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        role: true,
        profilePic: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get job counts for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const [totalJobs, completedJobs, activeJobs, failedJobs] = await Promise.all([
          prisma.job.count({ where: { userId: user.id } }),
          prisma.job.count({ where: { userId: user.id, status: JobStatus.COMPLETED } }),
          prisma.job.count({ where: { userId: user.id, status: JobStatus.ACTIVE } }),
          prisma.job.count({ where: { userId: user.id, status: JobStatus.FAILED } })
        ]);

        return {
          ...user,
          stats: {
            totalJobs,
            completedJobs,
            activeJobs,
            failedJobs
          }
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        total: usersWithStats.length
      }
    });

  } catch (error) {
    logger.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
}

/**
 * Get worker pool status
 * Accessible by: ADMIN only
 */
export async function getWorkerStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Get queue/worker statistics
    let queueStats;
    try {
      queueStats = await getQueueStats();
    } catch (error) {
      logger.warn('Failed to get queue stats:', error);
      queueStats = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
      };
    }

    // Mock worker data (in a real system, this would come from actual worker pool)
    const workers = [
      {
        id: 'worker-1',
        status: 'active',
        currentTask: queueStats.active > 0 ? 'Processing job...' : null,
        tasksProcessed: Math.floor(Math.random() * 1000) + 100,
        uptime: '5d 12h 30m',
        lastHeartbeat: new Date()
      },
      {
        id: 'worker-2',
        status: 'idle',
        currentTask: null,
        tasksProcessed: Math.floor(Math.random() * 1000) + 100,
        uptime: '3d 8h 15m',
        lastHeartbeat: new Date()
      },
      {
        id: 'worker-3',
        status: 'active',
        currentTask: queueStats.active > 1 ? 'Processing job...' : null,
        tasksProcessed: Math.floor(Math.random() * 1000) + 100,
        uptime: '7d 2h 45m',
        lastHeartbeat: new Date()
      }
    ];

    res.json({
      success: true,
      data: {
        workers,
        summary: {
          total: workers.length,
          active: workers.filter(w => w.status === 'active').length,
          idle: workers.filter(w => w.status === 'idle').length,
          offline: 0
        },
        queueStats
      }
    });

  } catch (error) {
    logger.error('Get worker status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch worker status'
    });
  }
}

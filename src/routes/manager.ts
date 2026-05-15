// Routes for manager team oversight
// Provides managers with visibility into their team's tasks, workload, and performance

import express, { Request, Response } from 'express';
import { protectRoute } from '../middleware/protectRoute';
import { requireManager } from '../middleware/roleMiddleware';
import { PrismaClient, JobStatus } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const router = express.Router();

// All routes require manager role
router.use(protectRoute);
router.use(requireManager);

// Get team overview stats
router.get('/team/stats', async (req: Request, res: Response) => {
  try {
    const managerId = req.user!.userId;

    // Get all team members
    const teamMembers = await prisma.user.findMany({
      where: { managerId },
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true,
        createdAt: true
      }
    });

    const teamMemberIds = teamMembers.map(m => m.id);

    // Get job statistics for the team
    const [totalJobs, activeJobs, completedJobs, failedJobs] = await Promise.all([
      prisma.job.count({
        where: { userId: { in: teamMemberIds } }
      }),
      prisma.job.count({
        where: {
          userId: { in: teamMemberIds },
          status: { in: [JobStatus.PENDING, JobStatus.ACTIVE] }
        }
      }),
      prisma.job.count({
        where: {
          userId: { in: teamMemberIds },
          status: JobStatus.COMPLETED
        }
      }),
      prisma.job.count({
        where: {
          userId: { in: teamMemberIds },
          status: JobStatus.FAILED
        }
      })
    ]);

    // Calculate success rate
    const totalFinishedJobs = completedJobs + failedJobs;
    const successRate = totalFinishedJobs > 0
      ? ((completedJobs / totalFinishedJobs) * 100).toFixed(1)
      : '0.0';

    res.json({
      success: true,
      data: {
        teamSize: teamMembers.length,
        totalJobs,
        activeJobs,
        completedJobs,
        failedJobs,
        successRate: parseFloat(successRate),
        teamMembers
      }
    });
  } catch (error) {
    logger.error('Failed to fetch team stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team stats'
    });
  }
});

// Get all team members
router.get('/team/members', async (req: Request, res: Response) => {
  try {
    const managerId = req.user!.userId;

    const teamMembers = await prisma.user.findMany({
      where: { managerId },
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true,
        createdAt: true,
        jobs: {
          select: {
            id: true,
            status: true,
            type: true,
            priority: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 5
        }
      },
      orderBy: {
        fullName: 'asc'
      }
    });

    const teamMemberIds = teamMembers.map(m => m.id);

    // Single grouped query replaces 4 × job.count per member
    const jobCountRows = await prisma.job.groupBy({
      by: ['userId', 'status'],
      where: { userId: { in: teamMemberIds } },
      _count: { id: true }
    });

    type MemberStats = { totalJobs: number; activeJobs: number; completedJobs: number; failedJobs: number };
    const statsByUser = new Map<string, MemberStats>(
      teamMemberIds.map(id => [id, { totalJobs: 0, activeJobs: 0, completedJobs: 0, failedJobs: 0 }])
    );
    for (const row of jobCountRows) {
      const entry = statsByUser.get(row.userId)!;
      const n = row._count.id;
      entry.totalJobs += n;
      if (row.status === JobStatus.PENDING || row.status === JobStatus.ACTIVE) {
        entry.activeJobs += n;
      } else if (row.status === JobStatus.COMPLETED) {
        entry.completedJobs = n;
      } else if (row.status === JobStatus.FAILED) {
        entry.failedJobs = n;
      }
    }

    const membersWithStats = teamMembers.map(member => ({
      ...member,
      stats: statsByUser.get(member.id) ?? { totalJobs: 0, activeJobs: 0, completedJobs: 0, failedJobs: 0 }
    }));

    res.json({
      success: true,
      data: membersWithStats,
      count: membersWithStats.length
    });
  } catch (error) {
    logger.error('Failed to fetch team members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team members'
    });
  }
});

// Get individual team member details
router.get('/team/members/:userId', async (req: Request, res: Response) => {
  try {
    const managerId = req.user!.userId;
    const { userId } = req.params;

    // Verify that this user is managed by the requesting manager
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        managerId
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Team member not found or access denied'
      });
      return;
    }

    // Get job statistics
    const [totalJobs, activeJobs, completedJobs, failedJobs, recentJobs] = await Promise.all([
      prisma.job.count({ where: { userId } }),
      prisma.job.count({
        where: {
          userId,
          status: { in: [JobStatus.PENDING, JobStatus.ACTIVE] }
        }
      }),
      prisma.job.count({
        where: { userId, status: JobStatus.COMPLETED }
      }),
      prisma.job.count({
        where: { userId, status: JobStatus.FAILED }
      }),
      prisma.job.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          status: true,
          priority: true,
          progress: true,
          createdAt: true,
          startedAt: true,
          completedAt: true
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        user,
        stats: {
          totalJobs,
          activeJobs,
          completedJobs,
          failedJobs
        },
        recentJobs
      }
    });
  } catch (error) {
    logger.error('Failed to fetch team member details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team member details'
    });
  }
});

// Get all team jobs
router.get('/team/jobs', async (req: Request, res: Response) => {
  try {
    const managerId = req.user!.userId;
    const { status, userId, limit = '50', offset = '0' } = req.query;

    // Get team member IDs
    const teamMembers = await prisma.user.findMany({
      where: { managerId },
      select: { id: true }
    });

    const teamMemberIds = teamMembers.map(m => m.id);

    if (teamMemberIds.length === 0) {
      res.json({
        success: true,
        data: [],
        count: 0
      });
      return;
    }

    // Build where clause
    const where: any = {
      userId: { in: teamMemberIds }
    };

    if (status) {
      where.status = status as JobStatus;
    }

    if (userId) {
      // Verify user is in team
      if (!teamMemberIds.includes(userId as string)) {
        res.status(403).json({
          success: false,
          message: 'Access denied to this user\'s jobs'
        });
        return;
      }
      where.userId = userId;
    }

    const [jobs, totalCount] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.job.count({ where })
    ]);

    res.json({
      success: true,
      data: jobs,
      count: totalCount,
      page: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch team jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team jobs'
    });
  }
});

// Get team workload distribution
router.get('/team/workload', async (req: Request, res: Response) => {
  try {
    const managerId = req.user!.userId;

    const teamMembers = await prisma.user.findMany({
      where: { managerId },
      select: {
        id: true,
        fullName: true,
        email: true
      }
    });

    const teamMemberIds = teamMembers.map(m => m.id);

    // Two batch queries replace 4 × per-member queries
    const [countRows, completedJobRows] = await Promise.all([
      prisma.job.groupBy({
        by: ['userId', 'status'],
        where: {
          userId: { in: teamMemberIds },
          status: { in: [JobStatus.ACTIVE, JobStatus.PENDING] }
        },
        _count: { id: true }
      }),
      prisma.job.findMany({
        where: {
          userId: { in: teamMemberIds },
          status: JobStatus.COMPLETED,
          startedAt: { not: null },
          completedAt: { not: null }
        },
        select: { userId: true, startedAt: true, completedAt: true },
        take: 50 * teamMemberIds.length
      })
    ]);

    type LoadEntry = { activeJobs: number; queuedJobs: number };
    const loadByUser = new Map<string, LoadEntry>(
      teamMemberIds.map(id => [id, { activeJobs: 0, queuedJobs: 0 }])
    );
    for (const row of countRows) {
      const entry = loadByUser.get(row.userId)!;
      if (row.status === JobStatus.ACTIVE) entry.activeJobs = row._count.id;
      else if (row.status === JobStatus.PENDING) entry.queuedJobs = row._count.id;
    }

    const durationByUser = new Map<string, { totalMs: number; count: number }>(
      teamMemberIds.map(id => [id, { totalMs: 0, count: 0 }])
    );
    for (const job of completedJobRows) {
      const entry = durationByUser.get(job.userId);
      if (entry && job.startedAt && job.completedAt) {
        entry.totalMs += new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime();
        entry.count += 1;
      }
    }

    const workloadData = teamMembers.map(member => {
      const load = loadByUser.get(member.id)!;
      const dur = durationByUser.get(member.id)!;
      return {
        userId: member.id,
        fullName: member.fullName,
        email: member.email,
        activeJobs: load.activeJobs,
        queuedJobs: load.queuedJobs,
        totalLoad: load.activeJobs + load.queuedJobs,
        avgCompletionTimeMs: dur.count > 0 ? Math.round(dur.totalMs / dur.count) : 0
      };
    });

    // Sort by total load descending
    workloadData.sort((a, b) => b.totalLoad - a.totalLoad);

    res.json({
      success: true,
      data: workloadData
    });
  } catch (error) {
    logger.error('Failed to fetch team workload:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team workload'
    });
  }
});

// Reassign job to different team member
router.patch('/team/jobs/:jobId/reassign', async (req: Request, res: Response) => {
  try {
    const managerId = req.user!.userId;
    const { jobId } = req.params;
    const { newUserId } = req.body;

    if (!newUserId) {
      res.status(400).json({
        success: false,
        message: 'newUserId is required'
      });
      return;
    }

    // Get team member IDs
    const teamMembers = await prisma.user.findMany({
      where: { managerId },
      select: { id: true }
    });

    const teamMemberIds = teamMembers.map(m => m.id);

    // Verify job belongs to team
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job || !teamMemberIds.includes(job.userId)) {
      res.status(404).json({
        success: false,
        message: 'Job not found or access denied'
      });
      return;
    }

    // Verify new user is in team
    if (!teamMemberIds.includes(newUserId)) {
      res.status(400).json({
        success: false,
        message: 'Target user is not in your team'
      });
      return;
    }

    // Reassign job
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        userId: newUserId,
        managerId // Track that manager reassigned this
      }
    });

    logger.info(`Job ${jobId} reassigned from ${job.userId} to ${newUserId} by manager ${managerId}`);

    res.json({
      success: true,
      data: updatedJob,
      message: 'Job reassigned successfully'
    });
  } catch (error) {
    logger.error('Failed to reassign job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reassign job'
    });
  }
});

export default router;

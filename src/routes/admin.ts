import express, { Request, Response } from 'express';
import { protectRoute } from '../middleware/protectRoute';
import { requireAdmin, requireManager } from '../middleware/roleMiddleware';
import { cache, invalidateCache } from '../middleware/cacheMiddleware';
import { WorkerTracker } from '../services/workerTracker';
import { logger } from '../utils/logger';
import { PrismaClient, UserRole } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();
const router = express.Router();

// Get worker stats
router.get('/workers', protectRoute, requireManager, async (req: Request, res: Response) => {
  try {
    const workerTracker = req.app.get('workerTracker') as WorkerTracker;

    if (!workerTracker) {
      res.status(503).json({
        success: false,
        message: 'Worker tracker not initialized'
      });
      return;
    }

    const stats = await workerTracker.getWorkerStats();
    const queueDepth = await workerTracker.getQueueDepth();

    res.json({
      success: true,
      data: {
        ...stats,
        queueDepth
      }
    });
  } catch (error) {
    logger.error('Failed to fetch worker stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch worker stats'
    });
  }
});

// Get queue depth only
router.get('/queue/depth', protectRoute, requireManager, async (req: Request, res: Response) => {
  try {
    const workerTracker = req.app.get('workerTracker') as WorkerTracker;

    if (!workerTracker) {
      res.status(503).json({
        success: false,
        message: 'Worker tracker not initialized'
      });
      return;
    }

    const queueDepth = await workerTracker.getQueueDepth();

    res.json({
      success: true,
      data: queueDepth
    });
  } catch (error) {
    logger.error('Failed to fetch queue depth:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch queue depth'
    });
  }
});

// Retry all failed jobs
router.post('/jobs/retry-failed', protectRoute, requireAdmin, async (req: Request, res: Response) => {
  try {
    const workerTracker = req.app.get('workerTracker') as WorkerTracker;

    if (!workerTracker) {
      res.status(503).json({
        success: false,
        message: 'Worker tracker not initialized'
      });
      return;
    }

    const count = await workerTracker.retryFailedJobs();

    logger.info(`Admin ${req.user?.userId} retrying ${count} failed jobs`);

    res.json({
      success: true,
      message: `Retrying ${count} failed jobs`,
      data: { count }
    });
  } catch (error) {
    logger.error('Failed to retry failed jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry jobs'
    });
  }
});

// Get worker by ID
router.get('/workers/:workerId', protectRoute, requireManager, async (req: Request, res: Response) => {
  try {
    const workerTracker = req.app.get('workerTracker') as WorkerTracker;

    if (!workerTracker) {
      res.status(503).json({
        success: false,
        message: 'Worker tracker not initialized'
      });
      return;
    }

    const stats = await workerTracker.getWorkerStats();
    const worker = stats.workers.find(w => w.id === req.params.workerId);

    if (!worker) {
      res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
      return;
    }

    res.json({
      success: true,
      data: worker
    });
  } catch (error) {
    logger.error('Failed to fetch worker:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch worker'
    });
  }
});

// ==================== USER MANAGEMENT ENDPOINTS ====================

// Get all users
router.get('/users', protectRoute, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { role, search, limit = '50', offset = '0' } = req.query;

    const where: any = {};

    if (role && typeof role === 'string') {
      where.role = role as UserRole;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          profilePic: true,
          createdAt: true,
          _count: {
            select: {
              jobs: true,
              comments: true
            }
          }
        },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: users,
      meta: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Get user by ID
router.get('/users/:userId', protectRoute, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        profilePic: true,
        createdAt: true,
        _count: {
          select: {
            jobs: true,
            comments: true,
            watchedJobs: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Failed to fetch user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

// Create new user
router.post('/users', protectRoute, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, fullName, username, password, role } = req.body;

    // Validate required fields
    if (!email || !fullName || !password) {
      res.status(400).json({
        success: false,
        message: 'Email, full name, and password are required'
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
      return;
    }

    // Generate username from email if not provided
    const finalUsername = username || email.split('@')[0];

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username: finalUsername }
        ]
      }
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: existingUser.email === email
          ? 'User with this email already exists'
          : 'Username already taken'
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        fullName,
        username: finalUsername,
        password: hashedPassword,
        role: role && Object.values(UserRole).includes(role) ? role : UserRole.USER
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true
      }
    });

    logger.info(`Admin ${req.user?.userId} created new user ${user.id}`);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
    });
  } catch (error) {
    logger.error('Failed to create user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
});

// Update user
router.put('/users/:userId', protectRoute, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { email, fullName, username, role, password } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // If email is being changed, check if new email already exists
    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email }
      });

      if (emailTaken) {
        res.status(409).json({
          success: false,
          message: 'Email already in use'
        });
        return;
      }
    }

    // If username is being changed, check if new username already exists
    if (username && username !== existingUser.username) {
      const usernameTaken = await prisma.user.findUnique({
        where: { username }
      });

      if (usernameTaken) {
        res.status(409).json({
          success: false,
          message: 'Username already taken'
        });
        return;
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (email) updateData.email = email;
    if (fullName) updateData.fullName = fullName;
    if (username) updateData.username = username;
    if (role && Object.values(UserRole).includes(role)) updateData.role = role;
    if (password) updateData.password = await bcryptjs.hash(password, 10);

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true
      }
    });

    logger.info(`Admin ${req.user?.userId} updated user ${userId}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    logger.error('Failed to update user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

// Delete user
router.delete('/users/:userId', protectRoute, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Prevent admin from deleting themselves
    if (userId === req.user?.userId) {
      res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
      return;
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId }
    });

    logger.info(`Admin ${req.user?.userId} deleted user ${userId}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
});

// ==================== TEAM MANAGEMENT ENDPOINTS ====================

// Get team members (users with their stats)
router.get('/team', protectRoute, requireManager, cache({ ttl: 30, keyPrefix: 'admin:team' }), async (req: Request, res: Response) => {
  try {
    const { role, status } = req.query;

    const where: any = {};
    if (role && typeof role === 'string') {
      where.role = role as UserRole;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        profilePic: true,
        createdAt: true,
        jobs: {
          select: {
            id: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        _count: {
          select: {
            jobs: true,
            comments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate stats for each user
    const teamMembers = users.map(user => ({
      ...user,
      stats: {
        totalJobs: user._count.jobs,
        activeJobs: user.jobs.filter(j => j.status === 'ACTIVE' || j.status === 'PENDING').length,
        completedJobs: user.jobs.filter(j => j.status === 'COMPLETED').length,
        failedJobs: user.jobs.filter(j => j.status === 'FAILED').length,
        totalComments: user._count.comments
      },
      recentJobs: user.jobs
    }));

    res.json({
      success: true,
      data: teamMembers
    });
  } catch (error) {
    logger.error('Failed to fetch team members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team members'
    });
  }
});

// Get team member details
router.get('/team/:userId', protectRoute, requireManager, cache({ ttl: 60, keyPrefix: 'admin:team:details' }), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        profilePic: true,
        createdAt: true,
        jobs: {
          select: {
            id: true,
            type: true,
            status: true,
            priority: true,
            createdAt: true,
            completedAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        comments: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            job: {
              select: {
                id: true,
                type: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: {
            jobs: true,
            comments: true,
            watchedJobs: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Failed to fetch team member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team member'
    });
  }
});

export default router;
